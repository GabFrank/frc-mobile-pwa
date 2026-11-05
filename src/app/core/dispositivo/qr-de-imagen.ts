import { detectorNativo } from './escaner.types';

/**
 * Lee un QR de una imagen fija (una foto ya sacada), no del video.
 *
 * Una foto tiene mucha más resolución que un frame de la cámara en vivo: un
 * QR chico o lejos, que el escáner no llega a enfocar, muchas veces se lee
 * de la foto completa.
 *
 * Mismo par de motores que el escáner: `BarcodeDetector` donde exista
 * (Chromium) y **ZXing** para Safari —y como segundo intento en Chromium,
 * con `TRY_HARDER`, que busca más a fondo que ML Kit en una imagen sucia—.
 * ZXing entra por `import()` dinámico.
 *
 * Devuelve el texto del QR o `null`.
 */
export async function leerQrDeImagen(lienzo: HTMLCanvasElement): Promise<string | null> {
  const Detector = detectorNativo();
  if (Detector) {
    try {
      const codigos = await new Detector({ formats: ['qr_code'] }).detect(lienzo);
      const valor = codigos?.[0]?.rawValue;
      if (valor) {
        return String(valor);
      }
    } catch {
      /* sigue con ZXing */
    }
  }

  try {
    const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const pistas = new Map<number, unknown>([[DecodeHintType.TRY_HARDER, true]]);
    return new BrowserQRCodeReader(pistas as never).decodeFromCanvas(lienzo).getText() || null;
  } catch {
    // NotFoundException: no hay QR legible. No es un error para el usuario.
    return null;
  }
}
