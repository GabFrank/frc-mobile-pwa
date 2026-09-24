# Escáner de códigos

> **Vigente.** Describe lo que hay en `frc-mobile-pwa`, no en el repo anterior.
> Para el escáner de Capacitor que se reemplaza, ver [`capacitor-nativo.md`](capacitor-nativo.md).

**Ubicación:** `src/app/core/dispositivo/`
**Punto de entrada:** `EscanerService.escanear()`

> Esto cubre **cómo se lee** un código. Qué dice adentro un QR del sistema, en
> qué campo cae el id de cada tipo y adónde lleva cada uno está en
> [`qr-del-sistema.md`](qr-del-sistema.md).

## Qué resuelve

Leer códigos de barra y QR con la cámara del teléfono, sin Capacitor y sin
plugins nativos. Es **infraestructura compartida**: la usan la confirmación de
convenios por QR, y la van a usar venta-tarjeta, solicitud de gastos y la
búsqueda de producto por código.

## Cómo se usa

```ts
const codigo = await this.escaner.escanear({
  titulo: 'Confirmar compra',
  ayuda: 'Apuntá al QR que muestra la caja',
  formatos: FORMATOS_QR,
  etiquetaManual: 'Código del convenio',
});
if (!codigo) return;   // el usuario canceló
```

Devuelve un `string` o `undefined`. La pantalla **no sabe** de dónde salió el
código: de la cámara, de la carga manual o —el día que haga falta— de un
lector Bluetooth. Esa es toda la razón de que exista el servicio.

## Las tres vías

| # | Vía | Dónde funciona |
|---|---|---|
| 1 | `BarcodeDetector` | Chromium, Android incluido. Por debajo es ML Kit: **el mismo motor** que el plugin de Capacitor del repo anterior |
| 2 | **ZXing** | **Safari y Firefox** — el camino de iOS |
| 3 | Carga manual | Siempre |

La cámara se pide **una sola vez** y recién después se elige el motor. Así el
permiso, la traducción de errores y la linterna son los mismos por los dos
caminos: lo único que cambia entre Android e iOS es quién mira los frames.

### ZXing no cuesta nada en Android

Entra por `import()` dinámico, así que queda en un **chunk aparte de 460 kB
crudos / 91 kB transferidos que Chromium nunca descarga**. El bundle inicial
no se mueve.

> ⚠️ **iOS no es un caso futuro.** Soportar iPhone es uno de los motivos de
> esta migración: es lo que la APK no podía dar. Que hoy no haya iPhones en la
> flota no es razón para dejar Safari sin camino. Ver la **regla 7** de
> [`../../CLAUDE.md`](../../CLAUDE.md).

## La carga manual no es solo el plan B

Está disponible **desde el modo cámara**, con el botón «Ingresar a mano», no
únicamente cuando algo falla. Un código térmico gastado no lo lee ningún
motor, y el cajero necesita poder seguir igual.

## Decisiones que no son obvias

### Restringir los formatos es corrección, no performance

Pidiendo solo `qr_code` para confirmar un convenio se evita que la cámara lea
de refilón el código de barras de lo que hay sobre el mostrador y lo tome por
la respuesta. `FORMATOS_PRODUCTO` y `FORMATOS_QR` están en `escaner.types.ts`.

Además se **intersecta lo pedido con lo que el navegador declara soportar**
(`getSupportedFormats()`): el constructor de `BarcodeDetector` puede rechazar
la lista entera por un solo formato desconocido, y se perdería el escaneo
completo por algo que no hacía falta.

### 12 lecturas por segundo, no 60

`frc-gourmet` detecta con `requestAnimationFrame`. Un lector de supermercado
apunta y espera: 12 por segundo se siente igual de instantáneo y no tiene al
teléfono a full con la cámara abierta, que es justo cuando la batería importa.
El bucle además **salta los intentos con la pestaña en segundo plano**: el
`<video>` no entrega frames nuevos y detectar sobre el último congelado es
puro gasto.

### La cámara se suelta siempre

El `DestroyRef` del diálogo corta el stream. Un stream sin liberar deja el led
del teléfono prendido y el usuario cree que la app lo sigue filmando.

### Los errores de la cámara se traducen

`NotAllowedError` → «No diste permiso»; `NotFoundError` → «No se encontró una
cámara»; `NotReadableError` → «Otra aplicación está usando la cámara». Los
tres son accionables. «Algo salió mal» no lo es.

## Contexto seguro

`getUserMedia` solo existe en **HTTPS o `localhost`**. Servir el dev server
por IP de red no alcanza. Para probar en un Android por USB:

```bash
adb reverse tcp:4300 tcp:4300
# el teléfono abre http://localhost:4300 y ve un contexto seguro
```

## Linterna

Se ofrece solo si la pista de video declara `torch` en sus capacidades, y se
prende con `applyConstraints({ advanced: [{ torch: true }] })`. Hay teléfonos
que declaran la capacidad y después rechazan la restricción: en ese caso el
botón desaparece en vez de quedar sin efecto.

## Qué falta probar

- **Los EAN-13 de balanza con prefijo `20`** sobre etiquetas térmicas reales.
  La lógica de parseo (`barcodeUtils.ts`) no cambia —opera sobre el string ya
  leído—; lo que falta confirmar es que `BarcodeDetector` los lea bien.
- **Dispositivos viejos de sucursal**, que es el caso de prueba que importa.
- **La vía de ZXing en un iPhone real.** Está cubierta por tests con un doble,
  que prueban que el camino existe y se corta bien — no que ZXing lea un EAN-13
  con la cámara de un iPhone. Eso pide un dispositivo.

Si el escaneo por cámara no rinde, la salida es la de siempre: los lectores
Bluetooth HID se comportan como teclado y funcionan igual en el navegador.
