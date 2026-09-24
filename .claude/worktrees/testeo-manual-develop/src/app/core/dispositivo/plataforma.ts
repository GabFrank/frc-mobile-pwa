/**
 * Detección de plataforma.
 *
 * Se usa **solo donde el navegador no ofrece una capacidad que detectar**.
 * Cuando hay una API que preguntar —`'BarcodeDetector' in window`,
 * `navigator.canShare`— se pregunta por la capacidad, que no miente y no
 * envejece. Detectar por user agent es el último recurso y está acá para que
 * sea uno solo, revisable, y no quince `includes('iPhone')` sueltos.
 *
 * El caso real que lo justifica: Safari no falla al abrir un PDF, **abre algo
 * que no sirve** —una pestaña en blanco, o la app que se va a Safari y no
 * vuelve—. No hay nada que preguntar antes; hay que saber que es Safari.
 */

/**
 * `true` en iPhone, iPad y iPod.
 *
 * ⚠️ **El iPad no dice ser un iPad.** Desde iPadOS 13 se anuncia como Mac
 * para recibir los sitios de escritorio, así que se lo reconoce por ser un
 * "Mac" con pantalla táctil. Un Mac de verdad reporta `maxTouchPoints` 0,
 * incluso con trackpad.
 */
export function esIos(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return true;
  }
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * `true` si la app corre instalada, fuera del navegador.
 *
 * Importa porque **es el caso más restrictivo**: sin barra de direcciones, una
 * pestaña nueva significa saltar a Safari y dejar la app. Lo que funciona en
 * la pestaña del navegador puede no funcionar acá.
 *
 * `navigator.standalone` es la propiedad que usa iOS; el resto usa
 * `display-mode`.
 */
export function esInstalada(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
