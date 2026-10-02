import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Sector } from '../domains/sector/sector.model';
import type { DatosZona } from '../pages/inventario/zona-dialog.component';
import { ZonaDialogComponent } from '../pages/inventario/zona-dialog.component';

describe('Diálogo de agregar zona', () => {
  let cerrar: ReturnType<typeof vi.fn>;

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const DATOS: DatosZona = {
    disponibles: [{ zonaId: 11, texto: 'estante alto', detalle: 'gondola' }],
    sectores: [{ id: 1, descripcion: 'gondola' } as Sector],
    contexto: 'SUC. CENTRAL',
  };

  beforeEach(() => {
    cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialogRef, useValue: { close: cerrar } }],
    });
  });

  const montar = (datos: Partial<DatosZona> = {}) => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { ...DATOS, ...datos } });
    const f = TestBed.createComponent(ZonaDialogComponent);
    f.detectChanges();
    return f;
  };

  /**
   * ⚠️ **La sucursal es el dato que evita agregar la zona a la toma
   * equivocada**, y estaba puesto como al pasar: un texto tenue y suelto que
   * no decía siquiera qué era. El repo ya tiene la forma correcta en
   * `frc-dato` — etiqueta tenue, valor destacado— y este diálogo la ignoraba.
   */
  it('dice de qué sucursal se trata, no solo su nombre suelto', () => {
    const f = montar();
    expect(texto(f)).toContain('Sucursal');
    // Titlecase al mostrar, como en el resto del módulo.
    expect(texto(f)).toContain('Suc. Central');
  });

  it('sin contexto no inventa una etiqueta vacía', () => {
    const f = montar({ contexto: undefined });
    expect(texto(f)).not.toContain('Sucursal');
  });

  it('elegir una zona la devuelve', () => {
    const f = montar();
    f.componentInstance.elegir(11);
    expect(cerrar).toHaveBeenCalledWith({ accion: 'elegir', zonaId: 11 });
  });

  it('crear manda la descripción en mayúsculas', () => {
    // En el central conviven cargas de años distintos y se comparan por
    // texto: guardar en minúscula llena el listado de duplicados que se ven
    // iguales. Es el par que ya usa Lugares del depósito.
    const f = montar();
    f.componentInstance.creando.set(true);
    f.componentInstance.descripcion.set('  rack del fondo  ');
    f.componentInstance.crear();

    expect(cerrar).toHaveBeenCalledWith({
      accion: 'crear',
      descripcion: 'RACK DEL FONDO',
      sectorId: 1,
      sectorNuevo: undefined,
    });
  });

  it('sin descripción no deja crear', () => {
    const f = montar();
    f.componentInstance.creando.set(true);
    f.componentInstance.descripcion.set('   ');
    expect(f.componentInstance.valido()).toBe(false);
  });

  it('con un sector nuevo vacío tampoco', () => {
    const f = montar();
    f.componentInstance.creando.set(true);
    f.componentInstance.descripcion.set('RACK');
    f.componentInstance.empezarSectorNuevo();
    expect(f.componentInstance.valido()).toBe(false);

    f.componentInstance.sectorNuevo.set('deposito fondo');
    expect(f.componentInstance.valido()).toBe(true);
  });

  it('cancelar desde el alta vuelve a la lista, no cierra el diálogo', () => {
    // Cerrar de una obliga a reabrir y volver a filtrar: la lista es el
    // lugar del que se vino.
    const f = montar();
    f.componentInstance.creando.set(true);
    f.componentInstance.volver();

    expect(f.componentInstance.creando()).toBe(false);
    expect(cerrar).not.toHaveBeenCalled();
  });
});
