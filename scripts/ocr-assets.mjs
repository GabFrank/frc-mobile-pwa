/**
 * Copia lo que necesita el lector de texto (Tesseract.js) a `public/ocr/`.
 *
 * Mismo criterio que `face-models.mjs`: **no se commitea** y no se baja de un
 * CDN en tiempo de ejecución. Por defecto Tesseract.js descarga el worker, el
 * núcleo WebAssembly y el idioma de `cdn.jsdelivr.net`: una sucursal sin
 * salida a internet no podría leer el CDC de una foto. Copiarlos desde
 * `node_modules` en cada build además ata los archivos a la versión instalada.
 *
 * Se sirven de `/ocr/` y el service worker los guarda recién cuando alguien
 * usa la lectura (grupo `ocr`, lazy en `ngsw-config.json`): el resto de los
 * usuarios no descarga estos ~17 MB.
 */
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const DESTINO = 'public/ocr';
const WORKER = 'node_modules/tesseract.js/dist/worker.min.js';
const NUCLEO = 'node_modules/tesseract.js-core';
const IDIOMA = 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';

/**
 * Solo las variantes LSTM (la lectura usa `OEM.LSTM_ONLY`). Tesseract elige
 * una según lo que soporte el navegador; cada teléfono baja una sola.
 */
const NUCLEOS = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

for (const origen of [WORKER, IDIOMA, ...NUCLEOS.map((n) => join(NUCLEO, n))]) {
  try {
    await stat(origen);
  } catch {
    console.error(`ocr-assets: falta ${origen}. ¿Corriste npm install?`);
    process.exit(1);
  }
}

await mkdir(DESTINO, { recursive: true });
await cp(WORKER, join(DESTINO, 'worker.min.js'));
for (const nucleo of NUCLEOS) {
  await cp(join(NUCLEO, nucleo), join(DESTINO, nucleo));
}
// El idioma va descomprimido: un servidor que manda los `.gz` con
// `Content-Encoding: gzip` haría que el navegador lo descomprima y Tesseract
// lo intente descomprimir otra vez.
await writeFile(join(DESTINO, 'eng.traineddata'), gunzipSync(await readFile(IDIOMA)));

let total = 0;
const archivos = await readdir(DESTINO);
for (const archivo of archivos) {
  total += (await stat(join(DESTINO, archivo))).size;
}
console.log(`ocr-assets: ${archivos.length} archivos, ${(total / 1024 / 1024).toFixed(1)} MB`);
