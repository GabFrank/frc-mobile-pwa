#!/usr/bin/env node
/**
 * Sello de versión de la build.
 *
 * El repo todavía no tiene versionado —`package.json` está en `0.0.0`, no hay
 * tags ni release— así que mostrar solo ese número no distinguiría una build de
 * otra. El sello combina las tres cosas que sí identifican una compilación:
 * la versión del paquete, la fecha y el commit.
 *
 * Corre dos veces por build, y hace algo distinto en cada una:
 *
 * 1. **Antes de compilar** — escribe `src/app/core/sello-version.ts`, que es lo
 *    que la app muestra como «versión instalada». Es un archivo generado y está
 *    en `.gitignore`: si se commiteara, cada build ensuciaría el diff.
 *
 * 2. **Después de compilar** (`--dist`) — reemplaza los marcadores en el
 *    `ngsw.json` de `dist/`. Ahí es donde el service worker lee `appData`, y es
 *    lo único que permite **nombrar la versión nueva antes de aplicarla**: el
 *    evento `VERSION_READY` trae el `appData` de la build que está esperando.
 *
 * ⚠️ **El marcador vive en `ngsw-config.json` y ese archivo no se toca.** Si el
 * sello se escribiera ahí, cada compilación dejaría un cambio para commitear.
 * Por eso el reemplazo es sobre `dist/`, que no está versionado.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** El commit corto. Si no hay git —un tarball, un contenedor— no se rompe. */
function commit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'sin-git';
  }
}

/** `2026-08-07 13:41` — local, que es la hora con la que se habla en la sucursal. */
function fechaLegible(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const cache = join(raiz, '.sello-version.json');

/*
  ⚠️ **El sello se calcula una vez y se reusa.**

  Antes cada pasada calculaba su propia fecha: la de `prebuild` quedaba con la
  hora de empezar y la de `--dist` con la de terminar, separadas por lo que
  tardara la compilación. El resultado se veía en el teléfono — el aviso
  ofrecía «Actualizar a 11:06» y después «Aplicación» mostraba 11:05, dos
  nombres para la misma build.
*/
const sello = process.argv.includes('--dist')
  ? JSON.parse(readFileSync(cache, 'utf8'))
  : { version: paquete.version, fecha: fechaLegible(), commit: commit() };

/**
 * Lo que se muestra como versión, y lo que dice el botón de actualizar.
 *
 * **Es el número de `package.json`**, que es lo que va a manejar
 * `semantic-release` igual que en los otros cuatro repos: `1.10.0-alpha.11`,
 * `1.2.0-beta.1`, `1.2.2`. El canal viaja adentro del propio número.
 *
 * ⚠️ **La fecha es solo el sustituto mientras no haya versionado.** Hoy
 * `package.json` está en `0.0.0` y no hay tags, así que «v0.0.0» sería el
 * mismo texto en todas las builds y el botón diría «Actualizar a v0.0.0»
 * sobre una app que ya dice v0.0.0. En cuanto el número sea real, esto pasa a
 * mostrarlo y la fecha queda donde corresponde: en la compilación.
 */
const etiqueta = sello.version === '0.0.0' ? sello.fecha : `v${sello.version}`;

if (process.argv.includes('--dist')) {
  const manifiesto = join(raiz, 'dist/mobile-pwa/browser/ngsw.json');
  if (!existsSync(manifiesto)) {
    console.error('sello-version: no existe', manifiesto);
    process.exit(1);
  }
  const contenido = readFileSync(manifiesto, 'utf8')
    .replace('__SELLO_ETIQUETA__', etiqueta)
    .replace('__SELLO_FECHA__', sello.fecha)
    .replace('__SELLO_COMMIT__', sello.commit);
  writeFileSync(manifiesto, contenido);
  console.log(`sello-version: ngsw.json sellado con ${etiqueta} (${sello.commit})`);
} else {
  writeFileSync(cache, JSON.stringify(sello));
  const destino = join(raiz, 'src/app/core/sello-version.ts');
  writeFileSync(
    destino,
    `/**
 * GENERADO POR \`scripts/sello-version.mjs\`. No editar a mano.
 *
 * Se reescribe antes de cada compilación y está en \`.gitignore\`.
 */
export const SELLO_VERSION = {
  /** Lo que se muestra como versión. Ver el script para la regla. */
  etiqueta: '${etiqueta}',
  /** \`true\` mientras la versión sea un sustituto por falta de versionado. */
  provisoria: ${sello.version === '0.0.0'},
  version: '${sello.version}',
  fecha: '${sello.fecha}',
  commit: '${sello.commit}',
} as const;
`,
  );
  console.log(`sello-version: ${etiqueta} (${sello.commit})`);
}
