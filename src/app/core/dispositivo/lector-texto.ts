/**
 * Lectura de texto en una imagen (OCR) con **Tesseract.js**, todo en el teléfono.
 *
 * Sin servidor ni IA: Tesseract corre en WebAssembly dentro de un Web Worker,
 * en Chromium y en Safari por igual.
 *
 * ⚠️ **Los archivos se sirven de `/ocr/`, no de un CDN.** Por defecto
 * Tesseract.js baja el worker, el núcleo y el idioma de `cdn.jsdelivr.net`;
 * `scripts/ocr-assets.mjs` los copia de `node_modules` en cada build. Son
 * ~17 MB en total pero cada teléfono baja ~9 (un solo núcleo + el idioma), y
 * recién la primera vez que alguien usa la lectura: el service worker los
 * guarda en el grupo `ocr`, que es lazy.
 *
 * ⚠️ **`tesseract.js` es CommonJS.** En el build de producción esbuild lo deja
 * con un solo `export default`, y `ng serve`/`npm test` le agregan además los
 * exports con nombre: `createWorker` se busca en los dos lugares.
 */

/** Un renglón leído y dónde está en la imagen. */
export interface RenglonLeido {
  texto: string;
  caja: { x0: number; y0: number; x1: number; y1: number };
}

export interface LecturaDeTexto {
  texto: string;
  renglones: RenglonLeido[];
}

export interface LectorDeTexto {
  /** Lee toda la imagen. */
  leer(imagen: HTMLCanvasElement): Promise<LecturaDeTexto>;
  /**
   * Relee un solo renglón, recortado y agrandado, aceptando solo `caracteres`.
   * Corrige lo que en la lectura general salió con una letra donde había un
   * número (un `9` leído `S`).
   */
  releerRenglon(imagen: HTMLCanvasElement, renglon: RenglonLeido, caracteres: string): Promise<string>;
}

/** Alto en píxeles al que se agranda un renglón antes de releerlo. */
const ALTO_RENGLON = 48;

/** `OEM.LSTM_ONLY`: el motor neuronal, el único para el que se copian núcleos. */
const OEM_LSTM = 1;

/** Modos de segmentación de Tesseract (`PSM`). */
const PSM_AUTOMATICO = '3';
const PSM_UN_RENGLON = '7';

type Trabajador = {
  recognize(
    imagen: HTMLCanvasElement,
    opciones?: object,
    salida?: object,
  ): Promise<{ data: DatosTesseract }>;
  setParameters(parametros: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
};

interface DatosTesseract {
  text?: string;
  blocks?: { paragraphs?: { lines?: { text?: string; bbox: RenglonLeido['caja'] }[] }[] }[] | null;
}

/**
 * Abre un lector, se lo pasa a `uso` y lo cierra al terminar, salga bien o mal.
 *
 * El worker ocupa decenas de MB de memoria: no se deja vivo entre lecturas.
 */
export async function conLectorDeTexto<T>(uso: (lector: LectorDeTexto) => Promise<T>): Promise<T> {
  const trabajador = await crearTrabajador();
  try {
    return await uso({
      leer: async (imagen) => {
        await trabajador.setParameters({
          tessedit_char_whitelist: '',
          tessedit_pageseg_mode: PSM_AUTOMATICO,
        });
        const { data } = await trabajador.recognize(imagen, {}, { text: true, blocks: true });
        return { texto: data.text ?? '', renglones: renglonesDe(data) };
      },
      releerRenglon: async (imagen, renglon, caracteres) => {
        await trabajador.setParameters({
          tessedit_char_whitelist: caracteres,
          tessedit_pageseg_mode: PSM_UN_RENGLON,
        });
        const { data } = await trabajador.recognize(recortar(imagen, renglon.caja));
        return (data.text ?? '').trim();
      },
    });
  } finally {
    await trabajador.terminate().catch(() => undefined);
  }
}

async function crearTrabajador(): Promise<Trabajador> {
  const modulo = (await import('tesseract.js')) as unknown as {
    createWorker?: CrearTrabajador;
    default?: { createWorker?: CrearTrabajador };
  };
  const createWorker = modulo.createWorker ?? modulo.default?.createWorker;
  if (!createWorker) {
    throw new Error('No se pudo cargar el lector de texto.');
  }
  const base = new URL('ocr/', document.baseURI).href;
  return createWorker('eng', OEM_LSTM, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    gzip: false,
    // El worker se crea desde la URL propia, no desde un blob: no depende de
    // que la política de contenido permita `blob:`.
    workerBlobURL: false,
    // El idioma ya lo guarda el service worker; sin esto se duplicaría en IndexedDB.
    cacheMethod: 'none',
  });
}

type CrearTrabajador = (idioma: string, oem: number, opciones: object) => Promise<Trabajador>;

function renglonesDe(data: DatosTesseract): RenglonLeido[] {
  const renglones: RenglonLeido[] = [];
  for (const bloque of data.blocks ?? []) {
    for (const parrafo of bloque.paragraphs ?? []) {
      for (const linea of parrafo.lines ?? []) {
        renglones.push({ texto: (linea.text ?? '').trim(), caja: linea.bbox });
      }
    }
  }
  return renglones;
}

/**
 * El renglón recortado con un margen y agrandado a {@link ALTO_RENGLON}: un
 * CDC impreso chico en una foto de toda la hoja queda con pocos píxeles por
 * dígito, y Tesseract lee mejor letra más grande.
 */
function recortar(imagen: HTMLCanvasElement, caja: RenglonLeido['caja']): HTMLCanvasElement {
  const alto = Math.max(1, caja.y1 - caja.y0);
  const margen = Math.round(alto * 0.3);
  const x = Math.max(0, caja.x0 - margen);
  const y = Math.max(0, caja.y0 - margen);
  const ancho = Math.min(imagen.width - x, caja.x1 - caja.x0 + 2 * margen);
  const altoRecorte = Math.min(imagen.height - y, alto + 2 * margen);
  const escala = Math.max(1, ALTO_RENGLON / alto);

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(ancho * escala));
  lienzo.height = Math.max(1, Math.round(altoRecorte * escala));
  const ctx = lienzo.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, x, y, ancho, altoRecorte, 0, 0, lienzo.width, lienzo.height);
  }
  return lienzo;
}
