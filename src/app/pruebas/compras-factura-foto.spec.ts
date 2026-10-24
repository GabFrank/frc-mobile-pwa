import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CabeceraFacturaFoto } from '../domains/compras/compras.model';
import { ComprasService } from '../pages/operaciones/compras/compras.service';
import { ElegirTipoFacturaComponent } from '../pages/operaciones/compras/elegir-tipo-factura.component';
import { FacturaFotoEstado } from '../pages/operaciones/compras/factura-foto.estado';
import { FacturaFotoPage } from '../pages/operaciones/compras/factura-foto.page';
import { RecepcionService } from '../pages/operaciones/recepcion/recepcion.service';

const CABECERA: CabeceraFacturaFoto = {
  documentoId: 55,
  pedidoId: null,
  cantidadFotos: 1,
  emisorRuc: '80012345-6',
  emisorNombre: 'DISTRIBUIDORA SA',
  rucValido: true,
  proveedorId: 7,
  proveedorNombre: 'DISTRIBUIDORA SA',
  timbrado: 12345678,
  establecimiento: '001',
  puntoExpedicion: '002',
  numero: '0001234',
  fechaEmision: '2026-10-20',
  condicion: 'CONTADO',
  moneda: 'PYG',
  totalGeneral: 150000,
  sumaRenglones: 150000,
  totalesCuadran: true,
  cantidadRenglones: 3,
  dudosos: [],
  avisos: [],
};

let compras: Record<string, ReturnType<typeof vi.fn>>;
let router: { navigate: ReturnType<typeof vi.fn> };
let cerrar: ReturnType<typeof vi.fn>;

const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

beforeEach(() => {
  compras = {
    leerFacturaFoto: vi.fn(() => of(CABECERA)),
    confirmarCabeceraFoto: vi.fn(() => of({ id: 99 })),
    fotoFactura: vi.fn(() => of('data:image/jpeg;base64,AAAA')),
  };
  router = { navigate: vi.fn(async () => true) };
  cerrar = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ComprasService, useValue: compras },
      { provide: RecepcionService, useValue: { proveedores: vi.fn(() => of({ getContent: [] })) } },
      { provide: Router, useValue: router },
      { provide: MatDialogRef, useValue: { close: cerrar } },
      { provide: MAT_DIALOG_DATA, useValue: { pedidoId: null } },
    ],
  });
});

describe('Elegir y leer la factura en papel', () => {
  const montarHoja = () => {
    const fixture = TestBed.createComponent(ElegirTipoFacturaComponent);
    fixture.componentInstance.enPapel.set(true);
    fixture.detectChanges();
    return fixture;
  };

  it('conTresFotosLlamaLeerConTres', async () => {
    const fixture = montarHoja();
    ['a', 'b', 'c'].forEach((x) => fixture.componentInstance.anadir('data:' + x));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')[1]
      .click();
    await fixture.whenStable();

    expect(compras['leerFacturaFoto']).toHaveBeenCalledWith(['data:a', 'data:b', 'data:c'], null);
    expect(router.navigate).toHaveBeenCalledWith(['/operaciones/compras', 'foto'], {
      queryParams: { documentoId: 55 },
    });
  });

  it('noDejaMasDeCinco', () => {
    const fixture = montarHoja();
    for (let i = 0; i < 7; i++) fixture.componentInstance.anadir('data:' + i);
    fixture.detectChanges();

    expect(fixture.componentInstance.fotos().length).toBe(5);
    // Con el tope alcanzado ya no se ofrece «Agregar».
    expect(texto(fixture)).not.toContain('Agregar');
  });
});

describe('Revisión de la cabecera leída de la foto', () => {
  const montar = (cabecera: CabeceraFacturaFoto, pedidoId?: string) => {
    TestBed.inject(FacturaFotoEstado).cabecera.set(cabecera);
    const fixture = TestBed.createComponent(FacturaFotoPage);
    fixture.componentRef.setInput('documentoId', String(cabecera.documentoId));
    if (pedidoId) fixture.componentRef.setInput('pedidoId', pedidoId);
    fixture.detectChanges();
    return fixture;
  };
  const continuar = (f: { nativeElement: HTMLElement }) =>
    Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      (b.textContent ?? '').includes('Continuar'),
    )!;

  it('campoDudosoSeMarca', () => {
    const fixture = montar({ ...CABECERA, dudosos: ['timbrado'] });

    expect(fixture.nativeElement.querySelectorAll('.campo.dudoso').length).toBe(1);
    expect(texto(fixture)).toContain('Revisá este dato');
  });

  it('continuarSinProveedorQuedaDeshabilitado', () => {
    const fixture = montar({ ...CABECERA, proveedorId: null, proveedorNombre: null, rucValido: false });

    expect(continuar(fixture).disabled).toBe(true);
    expect(texto(fixture)).toContain('Elegí el proveedor a mano');
  });

  it('confirmarNavegaANuevaCompra', () => {
    const fixture = montar(CABECERA);

    continuar(fixture).click();

    expect(compras['confirmarCabeceraFoto']).toHaveBeenCalledWith({
      documentoId: 55,
      proveedorId: 7,
      timbrado: 12345678,
      establecimiento: '001',
      puntoExpedicion: '002',
      numero: '0001234',
      fechaEmision: '2026-10-20',
      condicion: 'CONTADO',
      totalGeneral: 150000,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/operaciones/compras/nueva', 99], {
      replaceUrl: true,
    });
  });

  it('enPedidoElProveedorNoSeEdita', () => {
    const fixture = montar({ ...CABECERA, pedidoId: 12 }, '12');

    expect(texto(fixture)).not.toContain('Cambiar proveedor');
    expect(fixture.nativeElement.querySelector('input[type="search"], mat-form-field')?.textContent)
      .not.toContain('Buscar proveedor');
    continuar(fixture).click();
    expect(router.navigate).toHaveBeenCalledWith(['/operaciones/compras', 12, 'factura', 99], {
      replaceUrl: true,
    });
  });
});
