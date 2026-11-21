/**
 * Corrección de luz para el reconocimiento facial.
 *
 * Con poca luz o a contraluz, Human **sí encuentra la cara**, pero el
 * embedding sale degradado y la prueba de vida se cae:
 *
 * | Frame (banco de prueba, 2026-11-21)  | similitud propia | vida |
 * |---|---|---|
 * | cara al 12 % de luz, con ruido       | 0,71 → **0,83**  | 0,59 → 0,95 |
 * | cara al 8 % de luz, con ruido        | 0,52 → **0,77**  | 0,48 → 0,93 |
 * | contraluz (ventana atrás), con ruido | 0,79 → 0,79      | **0,16 → 1,00** |
 * | luz normal                           | 1,000 (no se toca) | — |
 *
 * La similitud es con la cara de la misma persona en buena luz; el umbral de
 * la marcación es 0,75 / 0,70. Las flechas son «sin aclarar → aclarado».
 *
 * ⚠️ **Se mide la luz de la cara, no la del frame.** La ecualización de Human
 * (`filter.equalization`) estira el histograma de la imagen entera: con una
 * ventana quemada atrás no cambia nada, y con mucho ruido llegó a perder la
 * cara. Por eso queda apagada y se aclara acá.
 *
 * ⚠️ **No se elige «el mejor» de dos frames.** La regla es fija: cara
 * oscura → se usa el aclarado. Quedarse con el que dé más `real`/`live`
 * sería darle a una foto dos oportunidades de pasar el anti-spoofing.
 *
 * ⚠️ **Los umbrales de la marcación no se tocan.** Esto mejora la imagen; la
 * regla de aceptación sigue siendo la misma.
 */

/** Por debajo de esta luminancia media (0..255) la cara se considera oscura. */
export const LUZ_MINIMA_CARA = 80;
/** A qué luminancia se lleva la cara al aclarar. */
export const LUZ_OBJETIVO_CARA = 130;
/**
 * Tope de la ganancia. Con ×8 el ruido amplificado hizo perder la cara en
 * los frames más oscuros del banco; ×4 fue el punto que rescata sin romper.
 */
export const GANANCIA_MAXIMA = 4;

/**
 * Cuánto multiplicar el frame para que la cara quede bien iluminada, o `null`
 * si ya tiene luz suficiente y no hay que tocarlo.
 */
export function gananciaParaLuz(luzMedia: number): number | null {
  if (!Number.isFinite(luzMedia) || luzMedia >= LUZ_MINIMA_CARA) {
    return null;
  }
  return Math.min(GANANCIA_MAXIMA, LUZ_OBJETIVO_CARA / Math.max(1, luzMedia));
}

/** Luminancia media (0..255) de píxeles RGBA. */
export function luminanciaMedia(rgba: ArrayLike<number>): number {
  const pixeles = Math.floor(rgba.length / 4);
  if (!pixeles) {
    return 0;
  }
  let suma = 0;
  for (let i = 0; i < pixeles * 4; i += 4) {
    suma += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return suma / pixeles;
}

/** Multiplica R, G y B por `ganancia`, en el lugar. El alfa no se toca. */
export function aplicarGanancia(rgba: Uint8ClampedArray, ganancia: number): void {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = rgba[i] * ganancia;
    rgba[i + 1] = rgba[i + 1] * ganancia;
    rgba[i + 2] = rgba[i + 2] * ganancia;
  }
}

/**
 * La zona donde medir la luz cuando todavía no se vio ninguna cara: el centro
 * del frame, que es donde la pantalla pide ponerla.
 */
export function zonaCentral(ancho: number, alto: number): [number, number, number, number] {
  return [ancho * 0.25, alto * 0.2, ancho * 0.5, alto * 0.6];
}

/**
 * Una copia aclarada del frame si la zona de la cara está oscura, o `null` si
 * no hace falta (o no se puede dibujar).
 *
 * `zona` es `[x, y, ancho, alto]` en píxeles del frame, como el `box` de
 * Human. Sin zona se mide el centro.
 */
export function frameAclarado(
  fuente: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  zona: [number, number, number, number] | null,
): HTMLCanvasElement | null {
  const ancho =
    (fuente as HTMLVideoElement).videoWidth || (fuente as HTMLImageElement).naturalWidth || fuente.width;
  const alto =
    (fuente as HTMLVideoElement).videoHeight || (fuente as HTMLImageElement).naturalHeight || fuente.height;
  if (!ancho || !alto || typeof document === 'undefined') {
    return null;
  }

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(fuente, 0, 0, ancho, alto);

  const [zx, zy, zw, zh] = zona ?? zonaCentral(ancho, alto);
  const x = Math.max(0, Math.round(zx));
  const y = Math.max(0, Math.round(zy));
  const w = Math.max(1, Math.min(Math.round(zw), ancho - x));
  const h = Math.max(1, Math.min(Math.round(zh), alto - y));
  if (x >= ancho || y >= alto) {
    return null;
  }

  const ganancia = gananciaParaLuz(luminanciaMedia(ctx.getImageData(x, y, w, h).data));
  if (ganancia == null) {
    return null;
  }

  const imagen = ctx.getImageData(0, 0, ancho, alto);
  aplicarGanancia(imagen.data, ganancia);
  ctx.putImageData(imagen, 0, 0);
  return lienzo;
}
