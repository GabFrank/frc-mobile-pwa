import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Los diálogos con caja propia tienen margen.
 *
 * La superficie de Material 21 no trae padding: lo pone `mat-dialog-content`.
 * Nueve diálogos arman su propia caja y quedaban con el contenido pegado al
 * borde. Lo arregla una regla de `styles.scss`.
 *
 * ⚠️ **Se mira el texto de la hoja, no el estilo aplicado**: los tests corren
 * en jsdom, que no carga `styles.scss` y tiene un soporte parcial de `:has()`.
 * Un `getComputedStyle` fallaría por el motivo equivocado. Lo visual se
 * verifica en el navegador.
 */
describe('Margen de los diálogos', () => {
  // ⚠️ No con `import.meta.glob(…, { query: '?raw' })`: en este runner todo
  // `.scss` llega **vacío** (el builder de Angular lo intercepta). Se lee del
  // disco.
  const hoja = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');
  const regla = hoja.match(/([^{}]*\.mat-mdc-dialog-surface:not\(:has\(\.mat-mdc-dialog-content\)\)[^{}]*)\{([^}]*)\}/);

  it('la hoja global se leyó', () => {
    expect(hoja.length).toBeGreaterThan(0);
  });

  it('da margen solo a los diálogos sin mat-dialog-content', () => {
    // Los que lo usan ya tienen el padding de Material: sumarle este lo duplicaría.
    expect(regla).not.toBeNull();
  });

  it('usa un token, en los cuatro lados', () => {
    expect(regla![2]).toMatch(/padding:\s*var\(--sp-3\)/);
  });

  it('excluye el escáner por el selector, no por el orden de las reglas', () => {
    // Las dos reglas pesan lo mismo: sin esto, el video a pantalla completa
    // quedaba con dos franjas negras.
    expect(regla![1]).toContain(':not(.frc-escaner-panel)');
  });
});
