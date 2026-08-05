/**
 * Tipos del escáner, aparte del servicio para que el diálogo no tenga que
 * importarlo y no se arme una dependencia circular.
 *
 * Las capacidades de dispositivo viven **detrás de una interfaz propia**, no
 * apoyadas directamente en la API del navegador. `frc-mobile` ya lo hacía con
 * los plugins de Capacitor, y es lo que permite que cambiar de motor de
 * lectura sea tocar un archivo y no doce pantallas.
 */

/**
 * Formatos que el escáner sabe leer.
 *
 * Son los nombres que espera `BarcodeDetector`, no una abstracción propia:
 * inventar un vocabulario paralelo solo agregaría una tabla de traducción.
 */
export type FormatoCodigo =
  | 'qr_code'
  | 'ean_13'
  | 'ean_8'
  | 'upc_a'
  | 'upc_e'
  | 'code_128'
  | 'code_39'
  | 'itf';

/**
 * Los ocho formatos del retail paraguayo, incluidos los EAN-13 de balanza con
 * prefijo `20`. Es la lista que viene de `frc-gourmet`, donde el escáner web
 * ya está en producción.
 */
export const FORMATOS_PRODUCTO: readonly FormatoCodigo[] = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
  'itf',
];

/** Solo QR. Para los códigos internos de la app (`frc-…`). */
export const FORMATOS_QR: readonly FormatoCodigo[] = ['qr_code'];

export interface OpcionesEscaneo {
  /** Texto de la barra superior. */
  titulo?: string;
  /** Qué se espera que apunte el usuario. */
  ayuda?: string;
  /**
   * Formatos a detectar. Restringirlos no es solo performance: pidiendo solo
   * `qr_code` se evita que la cámara lea de refilón el código de barras de un
   * producto y lo tome por la respuesta.
   */
  formatos?: readonly FormatoCodigo[];
  /** Etiqueta del campo de carga manual. */
  etiquetaManual?: string;
}

/** Mínimo de la API `BarcodeDetector` que se usa acá. */
export interface DetectorDeCodigos {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue?: string }[]>;
}

interface ConstructorDetector {
  new (opciones: { formats: readonly string[] }): DetectorDeCodigos;
  getSupportedFormats?(): Promise<string[]>;
}

/**
 * `BarcodeDetector` si el navegador lo trae.
 *
 * Está en Chromium sobre Android —donde corre la flota— y **no** en Safari ni
 * Firefox. No se declara en `lib.dom` todavía, así que se lee de `window` con
 * un tipo propio en vez de castear a `any` en cada uso.
 */
export function detectorNativo(): ConstructorDetector | null {
  const candidato = (globalThis as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
  return typeof candidato === 'function' ? candidato : null;
}

/** `true` si el navegador puede entregar la cámara. */
export function hayCamara(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
