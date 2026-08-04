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
  const estilos = import.meta.glob('../../**/*.{scss,ts}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('no usa tokens --mdc-, que Material 21 ya no lee', () => {
    const culpables = Object.entries(estilos)
      .filter(([ruta]) => !ruta.endsWith('.spec.ts'))
      .flatMap(([ruta, contenido]) =>
        contenido
          .split('\n')
          .map((linea, i) => ({ ruta, linea: linea.trim(), n: i + 1 }))
          // Se ignoran los comentarios: esta misma explicación los menciona.
          .filter(
            ({ linea }) =>
              /--mdc-[a-z0-9-]+\s*:/.test(linea) &&
              !linea.startsWith('//') &&
              !linea.startsWith('*'),
          )
          .map(({ ruta, linea, n }) => `${ruta}:${n} → ${linea}`),
      );

    expect(culpables).toEqual([]);
  });
});
