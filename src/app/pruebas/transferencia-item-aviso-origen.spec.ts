import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogoService } from '../core/ui/dialogo.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import type { TransferenciaItemData } from '../pages/transferencias/transferencia-item-dialog.component';
import { TransferenciaItemDialogComponent } from '../pages/transferencias/transferencia-item-dialog.component';

/**
 * El aviso de cantidad del diálogo del ítem no puede prometer «se manda
 * igual» cuando, al agregar un ítem nuevo, la verificación de stock del
 * borrador va a pedir confirmación o a bloquear.
 */
describe('Aviso de cantidad en origen del diálogo del ítem', () => {
  const DATOS: TransferenciaItemData = {
    producto: { id: 7, descripcion: 'GALLETITA' },
    presentacion: { id: 88, cantidad: 1 } as never,
    sucursalOrigenId: 1,
  };

  const texto = (f: { nativeElement: HTMLElement }) =>
    (f.nativeElement.querySelector('.stock')?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const montar = (stock: number, datos: Partial<TransferenciaItemData>, cantidad = 1) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: DialogoService, useValue: { abrir: vi.fn() } },
        { provide: ProductoBusquedaService, useValue: { stock: vi.fn(() => of(stock)) } },
      ],
    });
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { ...DATOS, ...datos } });
    const f = TestBed.createComponent(TransferenciaItemDialogComponent);
    f.componentInstance.cantidad.set(cantidad);
    f.detectChanges();
    return f;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('ítem nuevo con stock 0: pide confirmación y no dice «se manda igual»', () => {
    const t = texto(montar(0, { esNuevo: true }));
    expect(t).toBe('En origen hay 0 unidades. Al agregar se te va a pedir confirmación.');
    expect(t).not.toContain('se manda igual');
  });

  it('ítem nuevo con stock negativo: explica que se verifica según la configuración', () => {
    const t = texto(montar(-10, { esNuevo: true }));
    expect(t).toBe(
      'En origen hay -10 unidades. Al agregar se verifica el stock: puede pedir confirmación o no permitirlo, según la configuración.',
    );
    expect(t).not.toContain('se manda igual');
  });

  it('editar un ítem con stock negativo: el texto de siempre', () => {
    const draft = { cantidad: 1, vencimiento: null, observacion: '', lote: null };
    expect(texto(montar(-10, { draft }))).toBe(
      'En origen hay -10 unidades. Estás pidiendo 1: se manda igual, pero revisá.',
    );
  });

  it('sin la marca de ítem nuevo: el texto de siempre', () => {
    expect(texto(montar(0, {}))).toContain('se manda igual, pero revisá.');
  });

  it('ítem nuevo con stock positivo pero insuficiente: el texto de siempre', () => {
    expect(texto(montar(5, { esNuevo: true }, 8))).toBe(
      'En origen hay 5 unidades. Estás pidiendo 8: se manda igual, pero revisá.',
    );
  });
});
