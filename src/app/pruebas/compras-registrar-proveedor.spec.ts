import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProveedorDeFactura } from '../domains/compras/compras.model';
import { ComprasService } from '../pages/operaciones/compras/compras.service';
import { RegistrarProveedorDialogComponent } from '../pages/operaciones/compras/registrar-proveedor-dialog.component';

const SUGERENCIA: ProveedorDeFactura = {
  documentoId: 10,
  origen: 'SIFEN',
  ruc: '80012345',
  dv: '6',
  rucValido: true,
  nombre: 'DISTRIBUIDORA ACME S.A.',
  nombreFantasia: 'ACME',
  direccion: 'AVDA. ESPAÑA 1234',
  ciudad: 'ASUNCION (DISTRITO)',
  telefono: '021555666',
  email: 'ventas@acme.com.py',
  credito: true,
  proveedorId: null,
  puedeRegistrar: true,
};

let compras: Record<string, ReturnType<typeof vi.fn>>;
let cerrar: ReturnType<typeof vi.fn>;

const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

function montar(datos: ProveedorDeFactura | Error, data: object = { qr: 'QR' }) {
  compras = {
    proveedorDeFactura: vi.fn(() => (datos instanceof Error ? throwError(() => datos) : of(datos))),
    registrarProveedorDeFactura: vi.fn(() =>
      of({ ...SUGERENCIA, proveedorId: 900, proveedorNombre: 'DISTRIBUIDORA ACME S.A.', puedeRegistrar: false }),
    ),
  };
  cerrar = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ComprasService, useValue: compras },
      { provide: MatDialogRef, useValue: { close: cerrar } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const f = TestBed.createComponent(RegistrarProveedorDialogComponent);
  f.detectChanges();
  return f;
}

describe('Registrar proveedor desde la factura', () => {
  beforeEach(() => vi.clearAllMocks());

  it('precarga los datos de la factura y el RUC no se edita', () => {
    const f = montar(SUGERENCIA);

    expect(compras['proveedorDeFactura']).toHaveBeenCalledWith({ qr: 'QR', documentoId: undefined });
    const c = f.componentInstance;
    expect(c.nombre()).toBe('DISTRIBUIDORA ACME S.A.');
    expect(c.fantasia()).toBe('ACME');
    expect(c.direccion()).toBe('AVDA. ESPAÑA 1234');
    expect(c.telefono()).toBe('021555666');
    expect(c.email()).toBe('ventas@acme.com.py');
    expect(c.credito()).toBe(true);
    expect(c.chequeDias()).toBe(8);
    expect(texto(f)).toContain('80012345-6');
    expect(texto(f)).toContain('De la factura electrónica');
  });

  it('registra con lo corregido y cierra con el proveedor nuevo', () => {
    const f = montar(SUGERENCIA);
    const c = f.componentInstance;
    c.telefono.set('0981 123 456');
    c.fantasia.set('  ');

    c.guardar();

    expect(compras['registrarProveedorDeFactura']).toHaveBeenCalledWith({
      documentoId: 10,
      nombre: 'DISTRIBUIDORA ACME S.A.',
      nombreFantasia: null,
      direccion: 'AVDA. ESPAÑA 1234',
      telefono: '0981 123 456',
      email: 'ventas@acme.com.py',
      credito: true,
      chequeDias: 8,
    });
    expect(cerrar).toHaveBeenCalledWith({ proveedorId: 900, proveedorNombre: 'DISTRIBUIDORA ACME S.A.' });
  });

  it('si el central rechaza el alta, el motivo queda escrito y no cierra', () => {
    const f = montar(SUGERENCIA);
    compras['registrarProveedorDeFactura'].mockReturnValue(throwError(() => new Error('Los días de cheque van de 1 a 365.')));

    f.componentInstance.guardar();
    f.detectChanges();

    expect(texto(f)).toContain('Los días de cheque van de 1 a 365.');
    expect(f.componentInstance.guardando()).toBe(false);
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('sin razón social o con días de cheque fuera de rango no deja registrar', () => {
    const f = montar(SUGERENCIA);
    const c = f.componentInstance;
    c.nombre.set(' ');
    expect(c.valido()).toBe(false);
    c.nombre.set('ACME');
    c.chequeDias.set(0);
    expect(c.valido()).toBe(false);
    c.chequeDias.set(30);
    expect(c.valido()).toBe(true);
  });

  it('si ya es proveedor ofrece usarlo, sin registrar otro', () => {
    const f = montar({ ...SUGERENCIA, proveedorId: 7, proveedorNombre: 'ACME VIEJO', puedeRegistrar: false });

    expect(texto(f)).toContain('ACME VIEJO');
    expect(texto(f)).toContain('Usar este proveedor');
    expect(texto(f)).not.toContain('Registrar\n');
    f.componentInstance.usarExistente();
    expect(cerrar).toHaveBeenCalledWith({ proveedorId: 7, proveedorNombre: 'ACME VIEJO' });
    expect(compras['registrarProveedorDeFactura']).not.toHaveBeenCalled();
  });

  it('avisa que reutiliza la persona existente', () => {
    const f = montar({ ...SUGERENCIA, personaId: 33, personaNombre: 'CLIENTE ACME' });

    expect(texto(f)).toContain('CLIENTE ACME');
    expect(f.componentInstance.nombre()).toBe('CLIENTE ACME');
  });

  it('con persona existente muestra sus datos cargados sin dejar editarlos', () => {
    const f = montar({
      ...SUGERENCIA,
      personaId: 33,
      personaNombre: 'CLIENTE ACME',
      telefono: '0991000000',
      datosDePersona: ['telefono'],
    });
    const c = f.componentInstance;
    const inputs = Array.from(f.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
    const tel = inputs.find((i) => i.type === 'tel')!;
    const mail = inputs.find((i) => i.type === 'email')!;

    expect(c.telefono()).toBe('0991000000');
    expect(tel.disabled).toBe(true);
    expect(mail.disabled).toBe(false);
    expect(texto(f)).toContain('Dato actual de la persona');
  });

  it('con el RUC inválido muestra el motivo y no ofrece registrar', () => {
    const f = montar(
      { ...SUGERENCIA, origen: 'FOTO', rucValido: false, puedeRegistrar: false, motivo: 'no cierra con su dígito verificador' },
      { documentoId: 11 },
    );

    expect(compras['proveedorDeFactura']).toHaveBeenCalledWith({ qr: undefined, documentoId: 11 });
    expect(texto(f)).toContain('no cierra con su dígito verificador');
    expect(texto(f)).toContain('Leído de la foto');
    expect(f.nativeElement.querySelector('input')).toBeFalsy();
  });

  it('si no se pueden leer los datos muestra el error y deja reintentar', () => {
    const f = montar(new Error('SIFEN no respondió'));

    expect(texto(f)).toContain('SIFEN no respondió');
    compras['proveedorDeFactura'].mockReturnValue(of(SUGERENCIA));
    f.componentInstance.cargar();
    f.detectChanges();
    expect(f.componentInstance.nombre()).toBe('DISTRIBUIDORA ACME S.A.');
  });
});
