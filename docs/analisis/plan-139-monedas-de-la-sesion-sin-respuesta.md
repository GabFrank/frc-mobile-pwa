# Plan #139: un corte al leer las monedas de la sesión no hace pasar los dólares por guaraníes

Issue: GabFrank/frc-mobile-pwa#139. Rama: `fix/precios-moneda-sesion-sin-red`, **sobre `fix/precios-moneda-inactivos`
(#137, PR #140, apilado sobre #138)**: toca el mismo servicio y la misma pantalla. El PR va a `develop` y muestra los
commits de #135 y #137 hasta que se mergeen. Pieza: **mobile-pwa** solamente.

## Problema

`PrecioMonedaService.pedir` lee `preciosEnOtraMoneda` al entrar. **Cualquier** fallo deja `preciosMonedaSoportado =
false` y el mapa vacío, como si el central fuera viejo. Con un central que sí maneja precios en moneda, un corte de red,
un timeout o un 5xx al entrar hacen que:

- **todos** los precios en dólares se vean en guaraníes, en Precios y en el kiosco (ante un cliente);
- en Precios, editar el importe de uno abra la máscara de guaraníes y salga sin `monedaId`: el central conserva el USD
  y **30.000 pensados en guaraníes quedan como 30.000 US$**; agregar uno nuevo sin `monedaId` lo deja en la moneda del
  módulo PRECIOS, que puede ser USD;
- la lectura por producto de #137 no se pida (solo se pide con `soportado`).

Dura hasta la siguiente lectura (al guardar un precio o en la sesión siguiente).

## Enfoque

Separar **«el central no tiene la consulta»** de **«no pude preguntar»** (PATRONES §6) con `esFalloDeTransporte`
(`core/graphql/datos.service.ts`), que ya existe: un error de GraphQL **no** es transporte; red, timeout o 5xx sí.
Verificado contra el central alpha: un campo desconocido responde **HTTP 200** con `errors` (`FieldUndefined`), así que
un central viejo se clasifica bien.

**Servicio (`PrecioMonedaService`) y sesión (`MonedasSesion`):**
- Señal nueva `preciosMonedaSinRespuesta` (se limpia al salir): `true` si la última lectura falló por transporte.
- `pedir` con **tope de 8 s** (`timeout`): sin él, una red colgada (portal cautivo) no responde nunca y el kiosco queda
  esperando para siempre (A1). Un `TimeoutError` es transporte.
- Bien → como hoy, `sinRespuesta = false`. Error de GraphQL → central viejo, como hoy (`soportado = false`, mapa
  vacío, `sinRespuesta = false`). Transporte → `sinRespuesta = true`; el mapa y `soportado` quedan como estaban, pero
  **con `sinRespuesta` nadie confía en ellos** (ver abajo).
- `listo()`: si hay una lectura en curso, devuelve esa (dos llamadas no hacen dos pedidos, B2); si no y la última
  quedó sin respuesta, vuelve a pedir; si no, la última.

**Precios (`precios.page.ts`), moneda de un precio (`monedaGuardada`), en este orden:**

| Caso | Moneda |
|---|---|
| La lectura por producto la trae | esa |
| Sesión bien (`soportado` y sin `sinRespuesta`) | la de la sesión; si no está: activo → empresa, inactivo → no se sabe (#137) |
| La lectura por producto falló con error de GraphQL (central sin `PrecioPorSucursal.moneda`) | empresa (central viejo) |
| Sesión sin respuesta | **no se sabe**, activo o inactivo: lo que se sabía antes puede no incluir lo último guardado (B3) |
| Central viejo (`!soportado`, sin `sinRespuesta`) | empresa, como hoy |

- La lectura por producto se pide con `soportado || sinRespuesta` (un `computed`, así el `effect` dispara solo al
  cambiar, B5). Su error se clasifica igual: GraphQL → «sin consulta», transporte → «no respondió».
- Con la sesión sin respuesta, **«Agregar» queda bloqueado** en la plantilla y en el código (`agregarPrecio`), aunque
  la lectura por producto haya respondido: sin la sesión no se sabe si el central maneja monedas, y sin `monedaId` un
  precio nuevo cae en la moneda del módulo PRECIOS, que puede ser USD (B6).
- Editar un precio cuya moneda se sabe por la lectura por producto: la máscara es la suya y no se manda `monedaId`
  (con `soportado = false`), así que el central conserva la guardada. Si no se sabe, no se edita (#137).
- Aviso «No se pudo saber en qué moneda están los precios» con «Reintentar», que vuelve a pedir la lista de la sesión y
  la del producto.

**Kiosco (`kiosco.page.ts`):** muestra directo solo si la lista está lista **y** respondió
(`listos() && !sinRespuesta()`, B1); si no, espera `listo()` (que reintenta, con el tope). Si sigue sin respuesta, **no
muestra un importe**: usa el aviso de error que ya existe (`error`, `programarLimpieza`), liberando `buscando` y
`texto` (A5). Un central viejo sigue mostrando todo en guaraníes, como hoy.

**Descartado:**
- Reintentos con timers en el servicio: `listo()` reintenta cuando alguien lo necesita; el kiosco lo hace una vez por
  escaneo, en secuencia (A2).
- Conservar como válida la lectura previa tras un corte: un precio recién guardado no estaría y pasaría por guaraníes
  (B3).

**Fuera de alcance:** `MonedasSesion.limpiar()` no invalida una lectura en vuelo al cerrar sesión (pasa hoy).

## Fase única

- `core/moneda/monedas-sesion.ts`: `preciosMonedaSinRespuesta` y su limpieza.
- `domains/moneda/precio-moneda.service.ts`: la decisión de arriba en `pedir`, y `listo()` que reintenta.
- `pages/producto/editar/precios.page.ts`: lectura por producto también con `sinRespuesta` (y su error de GraphQL =
  central viejo), moneda desconocida para todos, bloqueo de «Agregar», aviso y «Reintentar» de las dos lecturas.
- `pages/producto/kiosco.page.ts`: la espera y el aviso.
- **Tests** (fallan con el código viejo):
  - servicio: fallo de transporte → `sinRespuesta`; error de GraphQL → central viejo; timeout → transporte;
    `listo()` reintenta tras transporte y no tras GraphQL; dos `listo()` concurrentes → un pedido;
  - precios: sesión sin respuesta y sin lectura por producto → nada editable en importe, «Agregar» bloqueado (también
    por código), activar sin `monedaId`; con la lectura por producto → se edita con su moneda y sin `monedaId`; un precio
    nuevo que no está en la lectura previa → no se sabe; lectura por producto con error de GraphQL → empresa;
    «Reintentar» pide las dos;
  - kiosco: lista lista pero sin respuesta → espera `listo()`; si sigue sin respuesta → aviso y ningún importe; central
    viejo → guaraníes como hoy.
- `docs/PLAN_TESTEO_MANUAL.md` (bloque nuevo, totales) y `docs/modulos/producto.md`.

## Contrato y canales

Sin cambios de GraphQL ni de central. En bodega y farmacia (centrales sin precios en moneda) la lista falla con error
de GraphQL: siguen exactamente como hoy.

## Pruebas de runtime

PWA local contra alpha, MR, con un precio en USD activo y uno inactivo:
1. Cortar `preciosEnOtraMoneda` en el navegador al entrar y abrir Precios: con la lectura por producto respondiendo,
   todo se ve y se edita en su moneda.
2. Cortar las dos: aviso, nada editable en importe, «Agregar» bloqueado; «Reintentar» con red lo arregla.
3. Kiosco con la lista cortada al escanear un producto en USD: reintenta y muestra US$; con todo cortado, aviso sin
   importe.
4. Regresión: sin cortes, igual que #137.

## Resultado de las pruebas de runtime (alpha, 11/11/2026)

PWA de la rama (`npm start`, 4300) contra el central alpha, usuario MR. Cortes por XHR instalados en la pestaña
**antes del login** (la lista se lee al entrar): `preciosEnOtraMoneda` y, aparte, la consulta por producto. Precio 10
de BANES FORTE en 4,50 US$ activo.

| # | Prueba | Resultado |
|---|---|---|
| 104.1 | Entrar con la lista cortada y abrir los precios | UNITARIO en «US$ 4,50» (lo dice la consulta por producto); «Agregar» bloqueado con «Reintentar». Con el código anterior, todo en guaraníes |
| 104.1 bis | Editar UNITARIO 4,50 → 4,55 con la lista cortada | Máscara en US$, mutation **sin** `monedaId`; la base queda 4,55 USD |
| 104.2 | Cortar también la consulta por producto | Los tres precios «Moneda sin confirmar», «Editar» deshabilitado, dos avisos con «Reintentar»; Activar/Desactivar/Marcar principal disponibles. «Reintentar» con red: todo vuelve |
| 104.3 (1) | Kiosco con la lista cortada (sesión «sin respuesta» por un refresco fallido tras guardar) | Reintenta la lista; como sigue cortada, «No se pudo confirmar el precio. Probá de nuevo.» y **ningún importe** |
| 104.3 (2) | Kiosco sin cortes | Muestra «₲ 5» en vez de «US$ 4,55» — **bug anterior del central**, ver abajo; la lista de la sesión sí tiene el precio en USD |

**Hallazgo, anterior a #139 (no lo cambia este PR):** `PrecioPorSucursalRepository.findPrincipalByPresentacionId` del
central hace `select *` sobre `presentacion` join `precio_por_sucursal`, y el `id` que se mapea es el de la
**presentación**. El `precioPrincipal` de BANES FORTE llega con id 5 (la presentación) en vez de 10. La PWA
(`precioEscogido`, `shared/producto/presentacion.util.ts`) usa ese principal, así que el kiosco busca la moneda del
precio 5, no la encuentra y **muestra en guaraníes todo precio principal en otra moneda**, con o sin red.

Alpha quedó como estaba: precio 10 en 20.735 Gs, activo y principal.

## Auditoría del diff (paso 8)

Fijo 1: sin cambios de permisos. Fijo 2: N/A. Fijo 3: sin operaciones nuevas; un central viejo (error de GraphQL)
sigue igual, verificado que responde 200 con `FieldUndefined`. Condicionales: no se disparan.

## Auditoría (paso 5, 11/11/2026)

| # | Hallazgo | Qué se hizo |
|---|---|---|
| A1 | `pedir` sin tope: una red colgada deja el kiosco esperando | `timeout` de 8 s |
| A2 | Reintentos por escaneo | Uno por escaneo, en secuencia, compartiendo el pedido en curso |
| A3 | ¿Un central viejo responde 200 o 400? | Verificado en alpha: 200 con `FieldUndefined` → central viejo |
| A4 | Central viejo + corte → todo bloqueado | Aceptado: es «no sé»; solo importes y «Agregar» |
| A5 | El kiosco tiene su aviso de error | Se reutiliza, liberando `buscando` y `texto` |
| B1 | El kiosco no entraba a reintentar (`listos` queda en `true` al fallar) | `listos() && !sinRespuesta()` |
| B2 | `listo()` concurrente | Reutiliza el pedido en curso |
| B3 | La lectura previa no tiene lo recién guardado | Con `sinRespuesta`, nada de la sesión vale |
| B4 | El error de la lectura por producto no se distinguía | Clasificado con `esFalloDeTransporte` |
| B5 | `effect` con dos señales | `computed` `puedeLeer` |
| B6 | «Agregar» sin `monedaId` cae en la moneda del módulo | Bloqueado con la sesión sin respuesta, en plantilla y código |
| B7 | Tests faltantes | Agregados |

## Sin verificar

- El comportamiento contra un central viejo real (bodega/farmacia) se cubre con tests: no se prueba contra producción.
