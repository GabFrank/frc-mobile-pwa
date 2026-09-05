import { describe, expect, it } from 'vitest';

import { PaginaComponent } from '../shared/layout/pagina.component';

const css = (comp: unknown) =>
  (comp as { ɵcmp: { styles: string[] } }).ɵcmp.styles
    .join('\n')
    .replace(/\[_nghost-%COMP%\]|\[_ngcontent-%COMP%\]/g, '')
    .replace(/\s+/g, '');

/**
 * La barra de acciones reparte el ancho desde el contenedor.
 *
 * El contenido de esa barra lo proyecta la pantalla, no `frc-pagina`, así
 * que no lleva su atributo de encapsulación: ninguna regla del tipo
 * `.acciones > *` puede alcanzarlo. Con la barra en flex, el envoltorio
 * proyectado se encogía a su contenido y el botón principal quedaba en
 * 112 px dentro de una barra de 430.
 *
 * En grid el reparto lo decide el contenedor y no hace falta apuntar al
 * hijo: uno ocupa todo, dos se reparten mitad y mitad.
 */
describe('Barra de acciones de la página', () => {
  it('reparte el ancho desde el contenedor, sin apuntar a los hijos', () => {
    const estilos = css(PaginaComponent);

    expect(estilos).toMatch(/\.acciones\{[^}]*display:grid/);
    expect(estilos).toMatch(/\.acciones\{[^}]*grid-auto-columns:1fr/);
    expect(estilos).not.toMatch(/\.acciones>\*/);
  });

  it('respeta el área segura del teléfono al pie', () => {
    // Sin esto, en un iPhone la barra queda debajo del indicador de inicio.
    expect(css(PaginaComponent)).toContain('env(safe-area-inset-bottom)');
  });
});
