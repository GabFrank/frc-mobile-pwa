# operaciones / venta-tarjeta

**Ubicación:** `src/app/pages/operaciones/venta-tarjeta/`
**Tamaño:** 18 archivos TS, ~1.265 LOC
**Ruta base:** `/operaciones/venta-tarjeta`

## Qué resuelve

**Conciliación de ventas cobradas con tarjeta.** Cuando el POS de la terminal bancaria procesa un pago, hay que ligar ese comprobante (código de autorización, número de boleta, monto) con la venta del sistema. Este módulo hace ese registro desde el celular, escaneando un QR generado por el punto de venta.

Sin este registro, la venta queda cobrada en el sistema pero sin respaldo del cupón bancario, y no se puede conciliar la acreditación de la tarjeta contra el `totalTarjeta` de la caja.

## Rutas

| Ruta | Componente | Guard |
|---|---|---|
| `''` | `ListVentaTarjetaComponent` | ✅ |
| `scan` | `ScanVentaTarjetaComponent` | ✅ |
| `registro` | `RegistroVentaTarjetaComponent` | ✅ |

**Las tres rutas están protegidas por `VentaTarjetaHabilitadaGuard`** — el único módulo del repo con guard de ruta propio.

## `VentaTarjetaHabilitadaGuard` — el patrón a copiar

La funcionalidad se habilita por **configuración del backend**. El guard consulta esa config antes de dejar entrar; si está deshabilitada, avisa y redirige a `/operaciones`.

Lo interesante es la estrategia de caché (`guards/venta-tarjeta-habilitada.guard.ts`):

```ts
const cacheado = this.ventaTarjetaService.getHabilitadaCacheada();

if (cacheado !== null) {
  // Refresco silencioso en segundo plano, sin bloquear esta navegación
  this.ventaTarjetaService.onGetConfiguracionHabilitada()
    .pipe(catchError(() => of(null)))
    .subscribe();
  return of(this.resolverDesdeHabilitado(cacheado));
}

return this.ventaTarjetaService.onGetConfiguracionHabilitada().pipe(
  map(habilitado => this.resolverDesdeHabilitado(habilitado)),
  catchError(() => of(this.router.createUrlTree(['/operaciones'])))
);
```

**Si hay valor en caché, navega instantáneamente y refresca en segundo plano.** Solo la primera navegación espera la red.

El caché vive en el servicio con TTL de **5 minutos** (`getHabilitadaCacheada(maxEdadMs = 300000)`); pasado ese tiempo devuelve `null` y se vuelve a consultar.

Motivación: el commit `9e42f70 fix(venta-tarjeta): guard de configuracion con cache en memoria para navegacion instantanea` (PR #87). Antes, cada entrada al módulo esperaba un round-trip contra el central — inaceptable en una LAN de sucursal con latencia.

> ⚠️ **Gotcha — si la consulta falla, el guard bloquea.** El `catchError` redirige a `/operaciones`. Con el central caído no se puede entrar al módulo aunque la función esté habilitada. Es deliberado: es preferible bloquear a permitir registrar contra una configuración desconocida.

> **Este es el patrón de referencia para features con flag de backend.** Copialo si necesitás otro.

## Modelo de datos

### `VentaTarjeta`

| Campo | Nota |
|---|---|
| `venta` | La venta del sistema: `{id, totalGs, creadoEn, usuario}` |
| `terminalPos` | Terminal bancaria: `{id, codigo, descripcion, moneda}` |
| `caja` | Caja donde se cobró |
| `codigoAutorizacion` | **Código del cupón bancario** |
| `numeroBoleta` | Número del comprobante |
| `monto` | Monto registrado a mano |
| `montoEscaneado` | **Monto leído por OCR del cupón** |
| `imagenUrl` | Foto del cupón |
| `estado` | `PENDIENTE` / `COMPLETADO` |

> **Regla clave — `monto` y `montoEscaneado` son dos campos distintos a propósito.** Uno es lo que carga el operador; el otro, lo que el OCR (`@pantrist/capacitor-plugin-ml-kit-text-recognition`) leyó del cupón fotografiado. Guardar ambos permite auditar discrepancias entre lo declarado y lo impreso. **No los unifiques.**

### `VentaTarjetaEstado`

`PENDIENTE` → `COMPLETADO`. Dos estados: registrada parcialmente vs. conciliada.

> ⚠️ **Gotcha — el modelo usa `interface`, no `class`, y no tiene `toInput()`.** Rompe el patrón del resto del repo (ver [`../infraestructura/domains-modelos.md`](../infraestructura/domains-modelos.md)): `VentaTarjetaInput` se arma a mano. Es más simple, pero no busques el método.

## El QR — `VentaTarjetaQrService`

Formato sobre el QR genérico de la app (ver [`../infraestructura/generic-utils.md`](../infraestructura/generic-utils.md)):

```
frc-{sucursalId}-VT-{...}-RegistroVentaTarjetaComponent-{cajaId|monto|ventaTarjetaId}-{timestamp}
                   ↑                    ↑                        ↑
             tipoEntidad          componentToOpen        data (separado por |)
```

El campo `data` lleva tres valores separados por `|`: `cajaId`, `monto` y, opcionalmente, `ventaTarjetaId`.

### `procesarQrVenta(texto, cajaActual): ProcesarQrVentaResult`

Valida en cascada y devuelve un motivo tipado ante cada fallo:

| Motivo | Cuándo |
|---|---|
| `qr-invalido` | No empieza con `frc-` |
| `no-es-venta-tarjeta` | `tipoEntidad !== 'VT'` |
| `qr-no-reconocido` | `componentToOpen !== 'RegistroVentaTarjetaComponent'` |
| `sin-caja` | El usuario no tiene caja abierta |
| `caja-distinta` | El `cajaId` del QR no coincide con la caja actual |

> **Regla clave — el QR solo se acepta desde la caja que lo emitió.** La validación `cajaIdQr !== cajaActual.id` impide que un operador registre el cupón de otra caja. Es la protección central del módulo: sin ella, un cupón podría imputarse a la caja equivocada y descuadrar dos arqueos a la vez.

> ⚠️ **Gotcha — el servicio existe porque hay dos puntos de entrada.** Lo usan `ScanVentaTarjetaComponent` (lista → escanear) **y el FAB "Escanear venta" del home** en `AppComponent`. Está documentado en el propio archivo. Si agregás otro punto de escaneo, usá este servicio — no reimplementes el parseo.

## Servicio — `VentaTarjetaService`

| Método | Qué hace |
|---|---|
| `onGetConfiguracionHabilitada()` | Consulta el flag y **actualiza el caché** |
| `getHabilitadaCacheada(maxEdadMs = 300000)` | Valor cacheado o `null` si venció |
| `onSave(input)` | Alta |
| `onUpdate(input)` | Edición |
| `onGetPorId(id, sucId)` | Detalle |
| `onGetPorVentaId(ventaId, sucId)` | Registro de una venta |
| `onGetPorCaja(cajaId, sucId)` | Todas las de una caja |
| `onCountSinRegistrar(cajaId, sucId)` | **Contador de pendientes** |

> ⚠️ **Gotcha — todos los métodos de consulta exigen `sucId`.** No hay variantes sin sucursal: el registro siempre está acotado a una.

`onCountSinRegistrar` alimenta el badge de pendientes: cuántas ventas con tarjeta de la caja actual todavía no tienen cupón registrado.

## Integración con el home

El FAB del home ofrece "Escanear venta" (`app.component.html:188`). `AppComponent` mantiene `ventaTarjetaHabilitada` (`actualizarVentaTarjetaHabilitada()`, `app.component.ts:409`) para mostrarlo u ocultarlo.

> ⚠️ **Gotcha — el FAB se ajusta cuando la función está deshabilitada.** El commit `8dd658c fix(venta-tarjeta): fab sin hueco con config deshabilitada` corrigió que quedaba un espacio vacío. Si agregás acciones al FAB, contemplá el caso condicional.

## Operaciones GraphQL

| Archivo | Tipo |
|---|---|
| `getConfiguracionVentaTarjeta.ts` | Query — flag de habilitación |
| `saveVentaTarjeta.ts` / `updateVentaTarjeta.ts` | Mutations |
| `ventaTarjetaPorId.ts` | Query |
| `ventaTarjetaPorVentaId.ts` | Query |
| `ventasTarjetaPorCaja.ts` | Query |
| `countVentasTarjetaSinRegistrar.ts` | Query |

## Al trabajar en este módulo

1. Respetá la validación de caja del QR: es la protección contra imputar un cupón a la caja equivocada.
2. `monto` y `montoEscaneado` son campos distintos; mantené ambos.
3. Para escanear desde otro lado, usá `VentaTarjetaQrService`.
4. El guard con caché + refresco en segundo plano es el patrón a replicar para otros feature flags.


---

# Qué cambió en la PWA

> **Estado:** portado — lista de cupones de la caja y registro por escaneo.
> **Sin OCR** (ver abajo).

| Ruta | Componente |
|---|---|
| `/operaciones/venta-tarjeta` | `VentaTarjetaListaPage` |
| `/operaciones/venta-tarjeta/registro` | `VentaTarjetaRegistroPage` |

Las dos pasan por `ventaTarjetaHabilitadaGuard`, con la **misma estrategia de
caché** del repo anterior: con el flag cacheado navega al instante y refresca
en segundo plano; solo la primera navegación espera la red. Si la consulta
falla, bloquea — es preferible a registrar contra una configuración
desconocida.

## El parseo del QR es una función pura

`interpretarQrVenta(texto, cajaActualId)` en vez de un servicio: no depende
de nada, se prueba sin montar Angular y **tiene un test por cada motivo de
rechazo**. Es la única validación de seguridad del módulo.

⚠️ **La comparación de caja es por valor.** Los ids llegan como string desde
GraphQL; un `!==` contra un número dejaría pasar el cupón de otra caja, que
es justo lo que hay que impedir.

## Sin OCR, y por eso sin foto

`frc-mobile` exigía fotografiar el cupón y un plugin de ML Kit
(`@pantrist/capacitor-plugin-ml-kit-text-recognition`) extraía el monto a
`montoEscaneado` para contrastarlo con el de la venta. **No hay equivalente
web** hoy.

> ⚠️ **La foto nunca se guardaba.** `imagenUrl` no viaja en
> `VentaTarjetaInput` (`add-venta-tarjeta.component.ts:383`): la imagen
> existía **solo** para alimentar el OCR. Por eso quitar el OCR quita también
> el requisito de la foto, sin perder ninguna evidencia — no había ninguna.

Los campos `montoEscaneado` e `imagenUrl` **se conservan** en el modelo: el
desktop sí los carga, y `monto` vs `montoEscaneado` es lo que permite
auditar discrepancias entre lo declarado y lo impreso.

Con el OCR se pierde también la confirmación de «monto diferente», que
comparaba lo escaneado contra lo cobrado. Vuelve si alguna vez hay OCR web.

## El monto no se edita

Es el de la venta, que ya está cobrada; lo que falta es el respaldo del
cupón. Editable permitiría registrar un importe que no cuadra con la caja.

## Lo que falta

| Qué | Espera a |
|---|---|
| OCR del cupón y `montoEscaneado` | una API web de reconocimiento de texto |
| Punto de entrada desde el home | el FAB del home, que no está portado |
