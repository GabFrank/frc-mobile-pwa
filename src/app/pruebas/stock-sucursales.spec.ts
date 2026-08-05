import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { Producto } from '../domains/productos/producto.model';
import {
  StockSucursalesData,
  StockSucursalesDialogComponent,
} from '../shared/producto/stock-sucursales-dialog.component';

describe('Stock por sucursal', () => {
  let sucursales: { todas: ReturnType<typeof vi.fn> };
  let busqueda: { stock: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const producto = Object.assign(new Producto(), { id: 1, descripcion: 'COCA COLA 2L' });

  /** La fila 0 es SERVIDOR y está activa: así viene de la base real. */
  const TODAS = [
    { id: 0, nombre: 'SERVIDOR' },
    { id: 1, nombre: 'SUC. CENTRAL' },
    { id: 3, nombre: 'SUC. ROTONDA' },
  ];

  beforeEach(() => {
    sucursales = { todas: vi.fn(() => of(TODAS)) };
    busqueda = { stock: vi.fn(() => of(7)) };

    TestBed.configureTestingModule({
      providers: [
        { provide: SucursalService, useValue: sucursales },
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
  });

  const montar = (data: Partial<StockSucursalesData> = {}) => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { producto, ...data } });
    const f = TestBed.createComponent(StockSucursalesDialogComponent);
    f.detectChanges();
    return f;
  };

  it('excluye al SERVIDOR: no es un local y no tiene stock', () => {
    const f = montar();

    expect(texto(f)).not.toContain('SERVIDOR');
    expect(texto(f)).toContain('SUC. CENTRAL');
    expect(busqueda.stock).toHaveBeenCalledTimes(2);
  });

  it('con la sesión parada en el SERVIDOR muestra todas, no ninguna', () => {
    // Caso real: la sucursal de la sesión llega como "0". Acotar a ella
    // dejaba el diálogo vacío — se filtraba a la 0 y después se la
    // descartaba por no ser un local.
    const f = montar({ sucursalId: '0' as unknown as number });

    expect(texto(f)).not.toContain('No hay sucursales');
    expect(texto(f)).toContain('SUC. CENTRAL');
    expect(texto(f)).toContain('SUC. ROTONDA');
  });

  it('acotado a una sucursal real muestra solo esa', () => {
    const f = montar({ sucursalId: 3 });

    expect(texto(f)).toContain('SUC. ROTONDA');
    expect(texto(f)).not.toContain('SUC. CENTRAL');
    expect(busqueda.stock).toHaveBeenCalledTimes(1);
  });

  it('compara ids por valor: el string "3" acota igual que el número', () => {
    const f = montar({ sucursalId: '3' as unknown as number });

    expect(texto(f)).toContain('SUC. ROTONDA');
    expect(busqueda.stock).toHaveBeenCalledTimes(1);
  });

  it('dibuja las filas antes de tener los números', () => {
    const lenta = new Subject<number>();
    busqueda.stock.mockReturnValue(lenta);
    const f = montar();

    // La lista ya está: el usuario ve qué se está consultando.
    expect(texto(f)).toContain('SUC. CENTRAL');
    expect(texto(f)).toContain('···');

    lenta.next(12);
    f.detectChanges();
    expect(texto(f)).toContain('12');
  });

  it('una filial caída no oculta el stock de las demás', () => {
    busqueda.stock.mockImplementation((_id: number, sucId: number) =>
      sucId === 1 ? throwError(() => new Error('sin red')) : of(9),
    );
    const f = montar();

    expect(texto(f)).toContain('sin dato');
    expect(texto(f)).toContain('9');
  });
});
