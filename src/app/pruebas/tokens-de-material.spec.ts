import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// El tipo lo aporta Vite; ver la nota en `sin-dialogos-nativos.spec.ts`.
declare global {
  interface ImportMeta {
    glob(patron: string, opciones: Record<string, unknown>): Record<string, string>;
  }
}

/**
 * Ningún estilo puede escribir un token `--mdc-*`.
 *
 * Angular Material 21 renombró toda esa familia a `--mat-*`. Los nombres
 * viejos **no producen ningún error**: la regla CSS se aplica, la variable
 * queda definida, y el componente sigue usando su valor por defecto. El
 * síntoma es siempre el mismo —"lo escribí y no pasó nada"— y ya nos costó
 * tres veces:
 *
 *   1. los toasts salían grises en vez de tomar su tono semántico;
 *   2. los botones salían como píldoras en vez de los 8 px aprobados;
 *   3. el color de etiqueta de los botones de texto y contorno.
 *
 * El tema precompilado de Material no contiene una sola aparición de
 * `--mdc-`, así que cualquiera que escribamos es letra muerta por definición.
 */
describe('Tokens de Material', () => {
  const archivos = import.meta.glob('../../**/*.{scss,ts}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  /**
   * ⚠️ **Los `.scss` se leen del disco.** En este runner el glob los devuelve
   * **vacíos** —el builder de Angular los intercepta—, así que el test pasaba
   * sin haber mirado nunca `styles.scss` ni `_tokens.scss`. Los `.ts` sí
   * llegan con su contenido. Las claves son relativas a este spec, y el CI
   * corre `npm test` desde la raíz.
   */
  const contenidoDe = (ruta: string, delGlob: string): string =>
    ruta.endsWith('.scss')
      ? readFileSync(resolve(process.cwd(), 'src/app/pruebas', ruta), 'utf8')
      : delGlob;

  const revisados = Object.entries(archivos)
    .filter(([ruta]) => !ruta.endsWith('.spec.ts'))
    .map(([ruta, delGlob]) => ({ ruta, contenido: contenidoDe(ruta, String(delGlob ?? '')) }));

  /**
   * Las líneas de código, sin comentarios.
   *
   * ⚠️ En una hoja los comentarios se quitan **como comentarios de SCSS**: los
   * bloques `/* … *\/` y las líneas `//`. Filtrar las líneas que empiezan con
   * `*` —que es el JSDoc de los `.ts`— descartaba en una hoja el selector
   * universal (`*, *::before…`), y un `--mdc-*` escrito ahí pasaba sin aviso.
   */
  const lineasDeCodigo = (ruta: string, contenido: string) => {
    const esHoja = ruta.endsWith('.scss');
    // Cada bloque se reemplaza por sus mismos saltos de línea: si no, el
    // `archivo:línea` de un culpable posterior sale corrido.
    const sinBloques = esHoja
      ? contenido.replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ''))
      : contenido;
    return sinBloques
      .split('\n')
      .map((linea, i) => ({ linea: linea.trim(), n: i + 1 }))
      .filter(({ linea }) => !linea.startsWith('//') && (esHoja || !linea.startsWith('*')));
  };

  it('no usa tokens --mdc-, que Material 21 ya no lee', () => {
    const culpables = revisados.flatMap(({ ruta, contenido }) =>
      lineasDeCodigo(ruta, contenido)
        .filter(({ linea }) => /--mdc-[a-z0-9-]+\s*:/.test(linea))
        .map(({ linea, n }) => `${ruta}:${n} → ${linea}`),
    );

    expect(culpables).toEqual([]);
  });

  it('revisa las hojas globales, y con su contenido', () => {
    // Sin esto, si el glob dejara de verlas —el spec o las hojas se mueven—,
    // la guarda de abajo no tendría nada vacío que detectar.
    for (const hoja of ['../../styles.scss', '../../styles/_tokens.scss']) {
      const revisado = revisados.find(({ ruta }) => ruta === hoja);
      expect(revisado, `${hoja} no está entre los revisados`).toBeDefined();
      expect(revisado!.contenido.length, `${hoja} llegó vacía`).toBeGreaterThan(0);
    }
  });

  it('ningún archivo revisado llega vacío', () => {
    // Una guarda que cuenta archivos no ve que están vacíos: así se escapó
    // que las hojas nunca se miraban.
    const vacios = revisados.filter(({ contenido }) => contenido.trim().length === 0).map(({ ruta }) => ruta);
    expect(vacios).toEqual([]);
  });
});
