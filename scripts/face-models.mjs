/**
 * Copia los modelos de reconocimiento facial a `public/face-models/`.
 *
 * **No se commitean**, y no es solo por peso (~10 MB). Los modelos tienen que
 * corresponder a la versión de `@vladmandic/human` que está instalada: el
 * embedding que produce `faceres` es lo que se compara contra la galería
 * guardada en el central, así que una copia vieja conviviendo con una
 * librería nueva da un fallo silencioso — reconoce peor, sin error.
 *
 * Copiarlos desde `node_modules` en cada build ata las dos cosas.
 *
 * `frc-mobile` los baja de `cdn.jsdelivr.net` en tiempo de ejecución, así que
 * una sucursal sin salida a internet no puede usar reconocimiento facial.
 *
 * También copia los binarios del backend **wasm** de TensorFlow a
 * `public/face-models/tfjs-wasm/`. Human corre en wasm —en la CPU, con float32
 * exacto— como el desktop y `frc-mobile`: en WebGL, las GPUs de algunos
 * celulares calculan con precisión reducida y `faceres` devuelve casi el mismo
 * vector para cualquier cara (issue #144). Los `.wasm` tienen que ser de la
 * misma versión de tfjs que Human trae adentro: si no, el build falla acá.
 */
import { cp, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ORIGEN = 'node_modules/@vladmandic/human/models';
const DESTINO = 'public/face-models';

/** Solo los que usa la configuración de `ReconocimientoFacialService`. */
const MODELOS = ['blazeface', 'facemesh', 'faceres', 'antispoof', 'liveness'];

try {
  await stat(ORIGEN);
} catch {
  console.error(`face-models: falta ${ORIGEN}. ¿Corriste npm install?`);
  process.exit(1);
}

await mkdir(DESTINO, { recursive: true });

let total = 0;
for (const modelo of MODELOS) {
  for (const ext of ['bin', 'json']) {
    const archivo = `${modelo}.${ext}`;
    await cp(join(ORIGEN, archivo), join(DESTINO, archivo));
    total += (await stat(join(DESTINO, archivo))).size;
  }
}

const ORIGEN_WASM = 'node_modules/@tensorflow/tfjs-backend-wasm';
const DESTINO_WASM = join(DESTINO, 'tfjs-wasm');
const versionWasm = JSON.parse(await readFile(join(ORIGEN_WASM, 'package.json'), 'utf8')).version;
const humanEsm = await readFile('node_modules/@vladmandic/human/dist/human.esm.js', 'utf8');
if (!humanEsm.includes(`"${versionWasm}"`)) {
  console.error(
    `face-models: @tensorflow/tfjs-backend-wasm ${versionWasm} no es la versión de tfjs que trae @vladmandic/human. ` +
      'Instalá la misma versión que usa Human.',
  );
  process.exit(1);
}
await mkdir(DESTINO_WASM, { recursive: true });
for (const archivo of ['tfjs-backend-wasm.wasm', 'tfjs-backend-wasm-simd.wasm', 'tfjs-backend-wasm-threaded-simd.wasm']) {
  await cp(join(ORIGEN_WASM, 'dist', archivo), join(DESTINO_WASM, archivo));
  total += (await stat(join(DESTINO_WASM, archivo))).size;
}

const presentes = (await readdir(DESTINO)).length;
console.log(`face-models: ${presentes} archivos, ${(total / 1024 / 1024).toFixed(1)} MB`);
