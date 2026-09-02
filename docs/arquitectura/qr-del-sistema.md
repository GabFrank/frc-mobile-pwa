# Los QR del sistema

> **Vigente.** Cómo están hechos los QR internos de Franco Systems, quién los
> emite y adónde lleva cada uno.
>
> Para **cómo se leen** —cámara, ZXing, carga manual— ver
> [`escaner.md`](escaner.md). Esto es lo que dice el código adentro.

**Dónde vive:** `src/app/generic/utils/qrUtils.ts` (formato),
`src/app/core/dispositivo/escaneo-ruteo.ts` (ruteo).

---

## El formato

Un QR del sistema es una cadena con campos separados por guion, con prefijo
`frc`:

```
frc-{sucursalId}-{tipoEntidad}-{idOrigen}-{idCentral}-{componentToOpen}-{data}-{timestamp}
```

`descodificarQr()` devuelve `null` si no empieza con `frc-` o si tiene menos
campos de los mínimos. Nunca devuelve un objeto a medias: en `frc-mobile` sí
lo hacía, con `undefined` en cada campo, y eso convertía cualquier texto
escaneado en un QR aparentemente válido.

### ⚠️ Son siete campos mínimos, no ocho

`codificarQr()` siempre emite ocho, pero **el central emite una variante
corta de siete** que no pasa por este archivo:

```java
// PreGastoService.construirQrRetiro() — central
"frc-" + sucursalCajaId + "-PRE_GASTO_RETIRO-" + preGastoId + "-"
       + sucursalId + "-" + qrToken + "-" + timestamp
```

El timestamp cae en la posición de `data` y `timestamp` queda vacío.

Cuando el decodificador exigía ocho, **el escaneo de retiro de caja chica
dejó de funcionar del todo**: el QR que imprime el cajero se rechazaba con
«Ese código no es de esta aplicación», y como el bloque de caja chica del
plan de testeo estaba escrito y sin correr, nadie lo vio.

Moraleja para cualquier validación nueva sobre este formato: **el sistema
emite más de una variante, y no todas salen de este repo.**

### ⚠️ El separador es el guion, y no hay escape

Un campo que contenga un guion desplaza todo lo que sigue. Es una limitación
conocida del formato (ítem 11 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md))
que **no se puede arreglar**: los QR ya impresos —los de los carteles de
depósito, los de las planillas— no se pueden reemitir.

Por eso los `qrToken` que genera el central son los primeros 8 caracteres de
un UUID: hexadecimal, sin guiones. Si alguien cambia esa generación, esto se
rompe en silencio.

---

## Dónde cae el id en cada tipo

**El id no está en el mismo campo para todos los tipos.** No es un descuido
que convenga normalizar: cada pantalla de `frc-mobile` que genera un QR
eligió su posición por su cuenta, y los QR impresos no se pueden reemitir.

Verificado generador por generador:

| `tipoEntidad` | Quién lo emite | Dónde está el id | Otros campos |
|---|---|---|---|
| `TRF` transferencia | `info-transferencia.component.ts:745` | `idOrigen` **y** `idCentral`, con el mismo valor | — |
| `INV` inventario | `edit-inventario.component.ts:530` | `idCentral` — **no escribe `idOrigen`** | `sucursalId` |
| `REC_MERC` recepción | `historico-nota-recepcion.component.ts:77` | `idCentral` e `idOrigen`, iguales | `sucursalId` |
| `VT` venta con tarjeta | el punto de venta (desktop) | `idOrigen` = venta | `componentToOpen` = `RegistroVentaTarjetaComponent`; `data` = `cajaId\|monto\|ventaTarjetaId` |
| `PRE_GASTO_RETIRO` | **el central**, `PreGastoService.java:500` | `idOrigen` = preGasto | `sucursalId` = sucursal de la **caja**; `idCentral` = sucursal del **gasto**; `componentToOpen` = `qrToken` |
| `VENTA_CREDITO` | el desktop, al armar el convenio | `idOrigen` = **persona** | `sucursalId`; `data` = clave de un solo uso; `timestamp` |
| `SUC` sucursal | cartel del depósito | `sucursalId` | — |

### El caso que más engaña

`PRE_GASTO_RETIRO` tiene tres campos en posiciones que su nombre no
anticipa. Leerlos por el nombre daba:

- la sucursal de la **caja** donde iba la del **gasto** — se notaba solo
  cuando la caja que paga es de otra sucursal, que es justamente para lo que
  existe `sucursalCaja`;
- el **timestamp** donde iba el **token** — el central respondía «código
  inválido o expirado».

Por eso interpretarlo vive en `interpretarQrRetiro()`, con sus tests, y no en
la pantalla. Lo mismo `interpretarQrVenta()` para el cupón.

⚠️ **`PRE_GASTO_RETIRO` no está en el enum `TipoEntidad`.** El central lo
escribe como cadena literal. Se declara como constante en
`gasto-retiro-qr.ts`; agregarlo al enum sería inventar un miembro que el
backend no conoce.

---

## El ruteo universal

El botón flotante lee cualquier código y decide el destino. La tabla vive en
`rutearEscaneo()` — función pura, con tests.

```
texto escaneado
   ├── ¿empieza con "frc-" y tiene ≥7 campos?
   │      ├── sí → según tipoEntidad
   │      └── no → código de barras de producto → /buscar?codigo=…
```

**El orden importa.** Primero se intenta leer como QR del sistema; recién si
no lo es se trata como código de producto. Al revés, un QR interno terminaría
buscándose como si fuera un EAN.

| Tipo | Destino |
|---|---|
| `TRF` | `/transferencias/:id` |
| `INV` | `/inventario/:id` |
| `REC_MERC` | `/operaciones/recepcion/:id` |
| `SOLPAG` | `/operaciones/solicitud-pago/:id` |
| `PRE_GASTO_RETIRO` | `/operaciones/gastos/:id/:sucursal?token=…` |
| `VT` | `/operaciones/venta-tarjeta?qr=…` — **entero** |
| `VENTA_CREDITO` | `/mis-finanzas?qr=…` — **entero** |
| `SUC` | Ninguno. Explica que se escanea desde adentro de un flujo |
| cualquier otro | Aviso de que no abre ninguna pantalla |

### Por qué tres viajan enteros

`VT`, `VENTA_CREDITO` y —parcialmente— el retiro **no se resuelven en el
ruteador**: necesitan contexto que el ruteador no tiene.

- El cupón de tarjeta solo lo puede registrar **el cajero de turno**, y eso
  se valida contra la caja abierta.
- La compra a crédito se autoriza contra **la persona en sesión**.
- El retiro se confirma contra su **token**.

El QR viaja entero por la URL y la pantalla de destino lo valida con la misma
función que usa su propio botón de escanear. **Es la parte que no se puede
duplicar**: si el camino del FAB hiciera su propia validación, podría
saltearse un control que el otro camino hace. Por eso `procesarQr()` está
separado de `escanear()` en esas pantallas, y los dos caminos lo llaman.

### Por qué por la URL y no por estado de navegación

Para que sobreviva a una recarga. El operador escanea, el service worker
adopta una versión nueva, la app se recarga — y el cupón no se puede perder
en el camino.

---

## Al agregar un tipo nuevo

1. **Mirá cómo lo emite quien lo emite**, no cómo se llama el campo. La tabla
   de arriba existe porque tres tipos no coinciden entre sí.
2. Si resuelve a un id, entra en `REGLAS` de `escaneo-ruteo.ts` declarando de
   qué campo sale su id. **No** uses `idCentral ?? idOrigen`: hoy funciona de
   casualidad y se rompe con el primer tipo que no siga esa forma.
3. Si necesita contexto de pantalla, va como caso aparte y viaja entero.
4. Usá `idDeRegistro()` para el id: `Number('')` es `0` y sin eso un QR
   incompleto navega al registro cero.
5. Sumá el caso a `escaneo-ruteo.spec.ts` con valores que **no coincidan
   entre sí**, para que leer un campo por otro haga fallar el test.

---

## Mandarlo por WhatsApp

El QR no siempre se escanea de pantalla a pantalla: muchas veces la otra
persona no está enfrente. `QrDialogComponent` tiene **Compartir**, que abre la
hoja del sistema con la imagen adjunta — ahí aparece WhatsApp con los
contactos recientes.

Es lo que `frc-mobile` hacía con `@capacitor/share`: escribía el PNG en el
caché con `Filesystem.writeFile` y le pasaba la URI al plugin. Acá no hace
falta ningún archivo en disco — `navigator.share` acepta un `File` en memoria—
y lo resuelve `CompartirService` (`core/dispositivo/compartir.service.ts`).

### Tres cosas que hay que saber antes de tocarlo

1. **Esa hoja no existe en el escritorio.** `navigator.share` está en Android
   y en Safari, pero no en Chrome de Linux ni en Firefox. La primera versión
   de esto **descargaba el PNG** cuando faltaba, y en la computadora el botón
   se leía como «no comparte nada, solo baja una imagen». Ahora el último
   recurso abre WhatsApp con un enlace `wa.me`: no puede llevar la imagen
   —ningún enlace puede— pero lleva el **enlace al registro**, que es lo que
   el otro toca. **Ningún camino termina en una descarga.**

2. **La imagen se compone al abrir el diálogo, no al tocar el botón.**
   `navigator.share` solo corre dentro del gesto del usuario; dibujar el PNG
   toma un par de ciclos y para cuando el blob está listo el gesto venció
   —Safari responde `NotAllowedError`—. Por eso `QrDialogComponent` la
   prepara en el constructor y el handler solo la adjunta. **Si alguna vez
   metés un `await` antes de `compartir()`, esto se rompe en iOS y anda en
   Android**, que es la peor forma de romperse.

3. **Cancelar también rechaza la promesa**, con `AbortError`. Tratarlo como
   error mostraba «no se pudo compartir» cada vez que alguien cerraba la
   hoja.

### Qué se manda

Desde el teléfono, una imagen de 608×704 px —el QR a 512 px con su rótulo
debajo, fondo blanco y tinta oscura **siempre**, porque sale del teléfono y no
tiene tema—. Desde cualquier lado, un texto de tres capas:

1. **El enlace al registro** (`https://…/transferencias/54061`). Es lo que el
   otro toca, y le abre la app directo en la transferencia. Lo construye
   `enlaceAlRegistro()` a partir de `rutearEscaneo`, o sea de la **misma
   tabla** a la que llega quien escanea: si mañana cambia dónde vive el
   detalle, el enlace cambia con ella.
2. **El QR**, cuando viajó como imagen adjunta.
3. **El código en claro**, para pegarlo en la carga manual del escáner.

⚠️ **Los QR con `queryParams` no dan enlace.** Ahí viaja el token que autoriza
un retiro de caja chica: en un mensaje de WhatsApp queda escrito para siempre.

⚠️ **El enlace sale del origen desde el que se comparte.** Compartiendo desde
`localhost:4300` el otro recibe un `localhost` que no le abre nada — en
desarrollo no hay ninguna URL pública que ofrecer.

El nombre del archivo sale del rótulo (`transferencia-54061.png`) para que en
la galería del que recibe no queden cinco `image.png` indistinguibles.

### Planes B, de mejor a peor

| Situación | Qué hace |
|---|---|
| Hoja con archivos (Android, Safari 15+) | Comparte la **imagen** con su texto — idéntico a `frc-mobile` |
| Hoja sin archivos | Comparte solo el texto — el enlace sigue sirviendo |
| Sin hoja (escritorio, Firefox) | Abre **WhatsApp Web** con el mensaje escrito |
| Popup bloqueado | Navega a WhatsApp en la misma vista |

Los cuatro están fijados en `compartir-qr.spec.ts`, y el que más importa es el
tercero: es el que se rompió.
