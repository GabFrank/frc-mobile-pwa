/**
 * Lado mayor al que se reduce una foto antes de mandarla.
 *
 * Alcanza para leer el número de una factura en pantalla. Una foto de
 * teléfono sin tocar son 3 a 5 MB, y en base64 crece un tercio más: eso
 * viaja **dentro de la mutation GraphQL**, en un campo de texto.
 */
const LADO_MAXIMO = 1600;

/** Calidad JPEG. Por debajo de esto el texto chico de una factura se ensucia. */
const CALIDAD = 0.75;

/**
 * Convierte una foto elegida por el usuario en un data URI reducido.
 *
 * ⚠️ **Se usa `<input type="file">`, no `getUserMedia`.** Con
 * `capture="environment"` el teléfono abre la cámara directamente, y es el
 * único camino que funciona igual en Safari de iOS —donde una captura por
 * `getUserMedia` obliga a montar el video y dibujarlo a mano—. Es también
 * el que deja elegir una foto ya sacada, que es lo que pasa cuando alguien
 * rinde al día siguiente.
 *
 * ⚠️ **La orientación EXIF se resuelve sola.** `createImageBitmap` con
 * `imageOrientation: 'from-image'` rota según el EXIF; sin eso, las fotos
 * verticales de varios Android llegan acostadas. Donde no exista, se cae a
 * un `<img>`, que en los navegadores actuales también respeta el EXIF.
 */
export async function fotoADataUri(archivo: File): Promise<string> {
  const bitmap = await decodificar(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) {
    throw new Error('Este navegador no puede procesar la imagen.');
  }
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, ancho, alto);

  return lienzo.toDataURL('image/jpeg', CALIDAD);
}

async function decodificar(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      // Safari viejo no acepta la opción; se sigue por el camino del <img>.
    }
  }

  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Se libera igual si `decode()` falló: si no, la foto queda en memoria
    // hasta que se recargue la app.
    URL.revokeObjectURL(url);
  }
}
