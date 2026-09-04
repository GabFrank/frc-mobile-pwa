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
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
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

const presentes = (await readdir(DESTINO)).length;
console.log(`face-models: ${presentes} archivos, ${(total / 1024 / 1024).toFixed(1)} MB`);
