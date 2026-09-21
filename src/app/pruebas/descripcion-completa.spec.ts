import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { Producto } from 'src/app/domains/productos/producto.model';
import {
  FilaConteo,
  InventarioItemCardComponent,
} from 'src/app/pages/inventario/inventario-item-card.component';
import { ProductoCardComponent } from 'src/app/shared/producto/producto-card.component';

const LARGA = 'COCA COLA ZERO SIN AZUCAR BOTELLA RETORNABLE 2,5 LITROS PACK X6 PROMOCION';

@Component({
  standalone: true,
  imports: [ProductoCardComponent],
  template: `<frc-producto-card [producto]="producto" />`,
})
class ConProducto {
  readonly producto = { id: 1, descripcion: LARGA } as Producto;
}

@Component({
  standalone: true,
  imports: [InventarioItemCardComponent],
  template: `<frc-inventario-item-card [fila]="fila" />`,
})
class ConFila {
  readonly fila = {
    itemId: 1,
    etiqueta: LARGA,
    presentacion: 'Unidad',
    sistema: '0',
    contado: null,
    diferencia: null,
    vencimiento: '',
    lote: null,
    productoConLote: false,
    fechaRetiro: '',
    conocido: null,
    vencido: false,
  } as unknown as FilaConteo;
}

function tituloDe(host: new () => unknown): HTMLElement {
  TestBed.configureTestingModule({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.titulo')!;
}

/**
 * La descripción del producto se lee entera en las listas.
 *
 * Con `nowrap` + `ellipsis` dos productos que comparten el principio del
 * nombre («COCA COLA 500ML…») eran indistinguibles en la fila. Se mira el
 * estilo que el navegador aplica, no el texto del CSS: así da igual cómo se
 * escriba la regla.
 */
describe('Descripción completa del producto en las listas', () => {
  for (const [nombre, host] of [
    ['la card del buscador', ConProducto],
    ['la card del conteo de inventario', ConFila],
  ] as const) {
    it(`${nombre} deja bajar el título a varias líneas`, () => {
      const titulo = tituloDe(host);
      expect(titulo.textContent?.trim()).toBe(LARGA);

      const estilo = getComputedStyle(titulo);
      expect(estilo.whiteSpace).not.toBe('nowrap');
      expect(estilo.textOverflow).not.toBe('ellipsis');
    });
  }
});
