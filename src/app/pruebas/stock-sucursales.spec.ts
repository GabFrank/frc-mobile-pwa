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
  let busqueda: { stockPorSucursales: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const producto = Object.assign(new Producto(), { id: 1, descripcion: 'COCA COLA 2L' });

  /**
   * Así viene de la base real: SERVIDOR y COMPRAS están activas pero **no
   * tienen depósito**, así que no mueven stock. `deposito` es lo que
   * discrimina, no el id ni el nombre.
   */
  const TODAS = [
    { id: 0, nombre: 'SERVIDOR', deposito: false, activo: true },
    { id: 999, nombre: 'COMPRAS', deposito: false, activo: true },
    { id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true },
    { id: 3, nombre: 'SUC. ROTONDA', deposito: true, activo: true },
    { id: 15, nombre: 'SUC. SAN PEDRO', deposito: true, activo: false },
  ];

  beforeEach(() => {
    sucursales = { todas: vi.fn(() => of(TODAS)) };
    // Una sola consulta devuelve el mapa completo. La sucursal 3 no está:
    // sin movimientos no vuelve fila, y eso significa cero.
    busqueda = { stockPorSucursales: vi.fn(() => of(new Map([['1', 7]]))) };

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

  it('excluye las sucursales sin depósito: no mueven stock', () => {
    const f = montar();

    expect(texto(f)).not.toContain('SERVIDOR');
    expect(texto(f)).not.toContain('COMPRAS');
    expect(texto(f)).toContain('SUC. CENTRAL');
  });

  it('excluye también las cerradas', () => {
    const f = montar();

    expect(texto(f)).not.toContain('SAN PEDRO');
  });

  it('pide el stock una sola vez, no una por sucursal', () => {
    montar();

    // Es la razón de existir de `stockPorSucursales`: 18 requests ocupaban
    // las 6 conexiones que el navegador da por origen.
    expect(busqueda.stockPorSucursales).toHaveBeenCalledTimes(1);
    expect(busqueda.stockPorSucursales).toHaveBeenCalledWith(1);
  });

  it('una sucursal sin movimientos se muestra en cero, no vacía', () => {
    // El GROUP BY no devuelve filas para sucursales sin movimientos.
    const f = montar();

    expect(texto(f)).toContain('SUC. ROTONDA');
    expect(texto(f)).toContain('0');
  });

  it('con la sesión en una sucursal virtual muestra todas, no ninguna', () => {
    // Caso real: la sucursal de la sesión llega como "0" y no tiene depósito.
    // Acotar a ella dejaba el diálogo vacío — se filtraba a la 0 y después se
    // la descartaba por no operar.
    const f = montar({ sucursalId: '0' as unknown as number });

    expect(texto(f)).not.toContain('No hay sucursales');
    expect(texto(f)).toContain('SUC. CENTRAL');
    expect(texto(f)).toContain('SUC. ROTONDA');
  });

  it('acotado a una sucursal con depósito muestra solo esa', () => {
    const f = montar({ sucursalId: 3 });

    expect(texto(f)).toContain('SUC. ROTONDA');
    expect(texto(f)).not.toContain('SUC. CENTRAL');
  });

  it('compara ids por valor: el string "3" acota igual que el número', () => {
    const f = montar({ sucursalId: '3' as unknown as number });

    expect(texto(f)).toContain('SUC. ROTONDA');
    expect(texto(f)).not.toContain('SUC. CENTRAL');
  });

  it('un producto por unidad no muestra decimales', () => {
    // El central devuelve la existencia como Double aunque cuente cajas.
    // "7,00" invita a leer que hay una fracción de unidad en algún lado.
    busqueda.stockPorSucursales.mockReturnValue(of(new Map([['1', 7]])));
    const f = montar();

    expect(texto(f)).toContain('7');
    expect(texto(f)).not.toContain('7,00');
  });

  it('un pesable sí muestra los decimales: son kilos', () => {
    const pesable = Object.assign(new Producto(), {
      id: 2,
      descripcion: 'QUESO PARAGUAY',
      balanza: true,
    });
    busqueda.stockPorSucursales.mockReturnValue(of(new Map([['1', 7.5]])));
    const f = montar({ producto: pesable });

    expect(texto(f)).toContain('7,500');
  });

  it('una existencia fraccionada de un producto por unidad no se redondea', () => {
    // Un ajuste mal cargado. Esconderlo detrás de un redondeo lo vuelve
    // invisible justo para quien podría corregirlo.
    busqueda.stockPorSucursales.mockReturnValue(of(new Map([['1', 7.5]])));
    const f = montar();

    expect(texto(f)).toContain('7,5');
  });

  it('un fallo de la consulta se muestra como error, no como ceros', () => {
    busqueda.stockPorSucursales.mockReturnValue(throwError(() => new Error('sin red')));
    const f = montar();

    expect(texto(f)).toContain('sin red');
  });

});
