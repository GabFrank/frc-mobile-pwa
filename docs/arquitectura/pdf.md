# Abrir PDFs

> **Vigente.** El backend genera recibos, balances y remitos con JasperReports
> y los devuelve en **base64**. La app solo tiene que mostrarlos.

**Ubicación:** `src/app/core/ui/pdf.service.ts`
**Punto de entrada:** `PdfService.abrirBase64(base64, nombre)`

## Qué reemplaza

`frc-mobile` usaba `PdfViewerService`, que escribía el archivo con plugins de
Capacitor y lo lanzaba con un visor nativo. Acá es `Blob` +
`URL.createObjectURL` y el visor del navegador.

## Un camino por plataforma

| Plataforma | Qué hace |
|---|---|
| Chromium / Firefox | Pestaña nueva. Bloqueada → descarga con `download` |
| iOS, en el navegador | Pestaña nueva. Bloqueada → **navega en la misma pestaña** |
| **iOS, PWA instalada** | **Siempre en la misma vista.** Nunca abre pestaña |

### Por qué iOS instalado es distinto

Una PWA instalada **no tiene pestañas**. `window.open` saca al usuario a
Safari: el PDF termina en otro programa, fuera de la app, sin forma obvia de
volver. Navegando en la misma vista, el visor de PDF de Safari toma el control
**dentro** de la app y el gesto de volver regresa a la pantalla anterior.

### Por qué `download` no sirve de plan B en iOS

iOS trata el atributo como una navegación normal en varias versiones. Como red
de contención no contiene nada: se termina en el mismo lugar, pero después de
haber intentado otra cosa. Por eso en iOS el plan B es navegar directamente.

## Esto se detecta por plataforma, no por capacidad

Es la excepción a la regla. En todo el resto de `core/dispositivo/` se
pregunta por la capacidad —`'BarcodeDetector' in window`— porque no miente y
no envejece. Acá no hay nada que preguntar: **Safari no falla al abrir el PDF,
abre algo que no sirve.** No hay API que devuelva «esto va a abrir una pestaña
que el usuario no va a poder cerrar».

La detección vive en un solo archivo, `core/dispositivo/plataforma.ts`, con
sus tests. No se copia un `includes('iPhone')` a ninguna pantalla.

> ⚠️ **El iPad no dice ser un iPad.** Desde iPadOS 13 se anuncia como
> Macintosh para recibir los sitios de escritorio. Se lo reconoce por ser un
> «Mac» con pantalla táctil: un Mac de verdad reporta `maxTouchPoints` 0,
> incluso con trackpad.

## Reglas de uso

### Llamar desde el manejador del clic, sin `await` en el medio

Los navegadores permiten abrir una ventana solo mientras dura el gesto del
usuario. Si se abre después de esperar la respuesta del servidor, el
bloqueador la corta. Por eso `abrirBase64` recibe el base64 **ya resuelto**:

```ts
// bien: la query ya terminó, el clic abre
verRecibo(recibo: Recibo): void {
  this.rrhh.imprimirRecibo(recibo.id).subscribe((base64) => {
    this.pdf.abrirBase64(base64, `recibo-${recibo.periodo}.pdf`);
  });
}
```

Sí, eso significa que el `window.open` de la línea de adentro ya está fuera
del gesto. **Es una limitación real y por eso existe el plan B**: cuando el
popup se bloquea, en escritorio se descarga y en iOS se navega. Ninguna de las
dos deja al usuario sin nada.

### El prefijo `data:` se limpia acá

El backend a veces manda `data:application/pdf;base64,…` y a veces no. `atob`
con el prefijo tira `InvalidCharacterError`. En el repo anterior cada pantalla
se acordaba —o se olvidaba— de limpiarlo.

## Qué falta probar

- **Un iPhone real, en las dos formas**: Safari normal y la PWA instalada
  desde «Compartir → Añadir a inicio». Los tests fijan qué camino toma cada
  caso; lo que no pueden decir es si el visor de Safari muestra bien el PDF de
  JasperReports.
- **Volver desde el visor** con la PWA instalada. Es el punto que justifica
  todo el camino aparte: si el gesto de atrás no devuelve a la app, hay que ir
  a un visor propio con el PDF embebido.
