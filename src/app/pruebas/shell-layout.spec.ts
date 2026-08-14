import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ShellComponent } from '../shell/shell.component';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

@Component({ standalone: true, template: '<p>contenido ruteado</p>' })
class PaginaFalsa {}

/**
 * Regresión del ancho del shell.
 *
 * `router-outlet` **no envuelve** al componente ruteado: Angular lo inserta
 * como hermano, inmediatamente después del `<router-outlet>`. Con `.area`
 * en `display: flex`, un `.area > * { flex: 1 }` reparte el ancho entre el
 * outlet —que está vacío— y la pantalla real. Resultado: toda la app
 * renderizaba a poco más de la mitad del ancho, pegada a la derecha.
 *
 * El bug es invisible en cualquier test que solo mire texto: el contenido
 * estaba ahí, correcto, y solo el layout estaba mal. Por eso este test mira
 * la estructura del DOM y la regla de estilo, no lo que dice la pantalla.
 */
describe('Layout del shell', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: APOLLO_DE_PRUEBA,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'ruta', component: PaginaFalsa }]),
      ],
    });
    await TestBed.inject(Router).navigate(['/ruta']);
  });

  it('inserta la pantalla ruteada como hermana del outlet, no dentro', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    const area = fixture.nativeElement.querySelector('.area') as HTMLElement;
    const outlet = area.querySelector('router-outlet') as HTMLElement;

    expect(outlet).not.toBeNull();
    // Si algún día Angular cambiara y el contenido pasara a vivir DENTRO del
    // outlet, esta expectativa falla y la regla de abajo deja de hacer falta.
    expect(outlet.children.length).toBe(0);
    expect(area.children.length).toBeGreaterThan(1);
  });

  it('no le pone el atributo de encapsulación del shell a la pantalla ruteada', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    const area = fixture.nativeElement.querySelector('.area') as HTMLElement;
    const outlet = area.querySelector('router-outlet') as HTMLElement;
    const pantalla = [...area.children].find((e) => e !== outlet) as HTMLElement;

    const atributoDeScope = [...outlet.attributes]
      .map((a) => a.name)
      .find((n) => n.startsWith('_ngcontent-'));

    // El outlet sí lo lleva —está en esta plantilla—; la pantalla ruteada no.
    // Esa asimetría es la razón por la que el ancho no puede pedirse con una
    // regla `.area > *`.
    expect(atributoDeScope).toBeDefined();
    expect(pantalla.hasAttribute(atributoDeScope!)).toBe(false);
  });

  it('estira la pantalla desde el contenedor, no con una regla sobre los hijos', () => {
    // Angular reescribe los selectores con su atributo de encapsulación
    // (`[_ngcontent-%COMP%]`); se quita para poder afirmar sobre el selector
    // tal como está escrito en el componente.
    const sinEspacios = (ShellComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles
      .join('\n')
      .replace(/\[_nghost-%COMP%\]|\[_ngcontent-%COMP%\]/g, '')
      .replace(/\s+/g, '');

    // El contenedor estira solo: una celda de grid, sin selector que apunte
    // al hijo.
    expect(sinEspacios).toMatch(/\.area\{[^}]*display:grid/);
    expect(sinEspacios).toMatch(/\.area\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
    // El outlet sale del grid en vez de reservar celda.
    expect(sinEspacios).toContain('.area>router-outlet{display:none;}');
    // Y no vuelve a aparecer una regla scopeada sobre los hijos de `.area`,
    // que nunca alcanzaría a la pantalla ruteada.
    expect(sinEspacios).not.toMatch(/\.area>\*/);
  });
});
