import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { MonedaModuloService } from '../core/moneda/moneda-modulo.service';
import { PrecioMonedaService } from '../domains/moneda/precio-moneda.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { DeletePrecioPorSucursalGQL } from '../graphql/productos/deletePrecioPorSucursal';
import { SavePrecioPorSucursalGQL } from '../graphql/productos/savePrecioPorSucursal';
import { TipoPreciosGQL } from '../graphql/productos/tipoPrecios';
import {
  PreciosPage,
  construirPrecioInput,
  esPrecioEditable,
  sucursalIdDePrecio,
} from '../pages/producto/editar/precios.page';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';
import { preciosADegradar } from '../pages/producto/editar/producto-editar.reglas';

describe('Editar un precio', () => {
  it('lo escribe en la sucursal de la sesión', () => {
    // El escritorio hace exactamente esto y no ofrece elegir:
    // adicionar-precio-dialog.component.ts:265.
    const input = construirPrecioInput(
      { id: null, precio: 12000, tipoPrecioId: 1, principal: true, activo: true },
      88,
      3,
    );
    expect(input.sucursalId).toBe(3);
    expect(input.presentacionId).toBe(88);
  });

  it('solo es editable el precio general, el de la sucursal del central (#135)', () => {
    // El `id` de `Sucursal` viaja como string (`ID` en el schema): un
    // fixture con ids `number` de los dos lados dejaría pasar un `===` roto.
    expect(esPrecioEditable({ sucursal: { id: '0' } }, 0)).toBe(true);
    // Uno de una sucursal concreta no, aunque sea la de la sesión: guardarlo
    // lo mudaría a la sucursal del central.
    expect(esPrecioEditable({ sucursal: { id: '3' } }, 0)).toBe(false);
  });

  it('sin la sucursal del central nada es editable', () => {
    // «No sé cuál es» no es «es esta».
    expect(esPrecioEditable({ sucursal: { id: '0' } }, null)).toBe(false);
  });

  it('un precio sin sucursal no es editable', () => {
    expect(esPrecioEditable({ sucursal: undefined }, 0)).toBe(false);
  });

  it('el id de la sucursal de un precio acepta el 0 y descarta lo que no es un id', () => {
    expect(sucursalIdDePrecio({ sucursal: { id: '0' } })).toBe(0);
    expect(sucursalIdDePrecio({ sucursal: { id: 7 } })).toBe(7);
    // `Number('')` es 0: el vacío no puede pasar por la sucursal del central.
    expect(sucursalIdDePrecio({ sucursal: { id: '' } })).toBeNull();
    expect(sucursalIdDePrecio({ sucursal: { id: 'x' } })).toBeNull();
    expect(sucursalIdDePrecio({ sucursal: null })).toBeNull();
  });

  it('degrada el principal anterior de esa presentación', () => {
    const precios = [
      { id: '1', precio: 12000, principal: true },
      { id: '2', precio: 11000, principal: false },
    ] as unknown as Parameters<typeof preciosADegradar>[0];
    expect(preciosADegradar(precios, 2).map((p) => p.id)).toEqual(['1']);
  });
});

/**
 * Precios con `tipoPrecioId = null`: 18 de 11.415 en la base real (0,2%).
 * `guardarEdicion`, `toggleActivo` y `marcarPrincipal` cortan antes de armar
 * el input porque `savePrecioPorSucursal` reemplaza la fila entera y un
 * `tipoPrecioId` inventado persistiría una clave ajena — pero cortar sin
 * avisar es el mismo bug que ya se corrigió dos veces en esta rama (la
 * degradación tragada y el catálogo reportado como cargado). Estos tests
 * verifican el aviso, no solo la ausencia de mutation.
 */
describe('Editar un precio sin tipo asignado', () => {
  let datos: { guardar: ReturnType<typeof vi.fn>; paginado: ReturnType<typeof vi.fn> };
  let notificacion: { danger: ReturnType<typeof vi.fn> };

  const sinTipo = () => ({
    id: 9,
    precio: 5000,
    principal: false,
    activo: true,
    tipoPrecio: undefined,
    sucursal: { id: '0' },
  });

  const estado = {
    cargando: () => false,
    error: () => null,
    producto: () => ({ id: 1 }),
    presentaciones: () => [{ id: 2, precios: [sinTipo()] }],
    cargar: vi.fn(),
    recargar: vi.fn(),
  };

  const montar = () => {
    datos = { guardar: vi.fn().mockReturnValue(of({})), paginado: vi.fn().mockReturnValue(of([])) };
    notificacion = { danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ProductoEditarService, useValue: estado },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: notificacion },
        { provide: AuthService, useValue: { sucursal: () => ({ id: 3 }), roles: () => [] } },
        { provide: SavePrecioPorSucursalGQL, useValue: {} },
        { provide: DeletePrecioPorSucursalGQL, useValue: {} },
        { provide: TipoPreciosGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
        { provide: MonedaModuloService, useValue: { monedaDe: vi.fn(async () => null) } },
        { provide: PrecioMonedaService, useValue: { cargar: () => Promise.resolve() } },
        { provide: SucursalService, useValue: { actual: () => of({ id: '0' }) } },
      ],
    });
    const f = TestBed.createComponent(PreciosPage);
    f.componentRef.setInput('id', '1');
    f.componentRef.setInput('presentacionId', '2');
    f.detectChanges();
    return f;
  };

  it('guardarEdicion avisa, no manda nada y libera la edición', () => {
    const f = montar();
    const p = f.componentInstance.preciosEditables()[0];
    f.componentInstance.iniciarEdicion(p);
    f.componentInstance.edicionValor.set(7000);

    f.componentInstance.guardarEdicion(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    // No se queda mostrando el valor nuevo como si se hubiera guardado.
    expect(f.componentInstance.edicionId()).toBeNull();
    expect(f.componentInstance.guardando()).toBe(false);
  });

  it('toggleActivo avisa y no manda nada', () => {
    const f = montar();
    const p = f.componentInstance.preciosEditables()[0];

    f.componentInstance.toggleActivo(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.guardando()).toBe(false);
  });

  it('marcarPrincipal avisa y no manda nada', () => {
    const f = montar();
    const p = f.componentInstance.preciosEditables()[0];

    f.componentInstance.marcarPrincipal(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.guardando()).toBe(false);
  });
});

/**
 * #135: el central guarda todo precio en su propia sucursal (0), así que los
 * editables son los de esa sucursal, que se le pregunta con `sucursalActual`.
 */
describe('Precios generales del central (#135)', () => {
  let datos: { guardar: ReturnType<typeof vi.fn>; paginado: ReturnType<typeof vi.fn> };

  const general = (id: number, principal = false, tipo = 1) => ({
    id,
    precio: 20735,
    principal,
    activo: true,
    tipoPrecio: { id: tipo, descripcion: 'T' + tipo },
    sucursal: { id: '0', nombre: 'SERVIDOR' },
  });
  const deSucursal = { ...general(50, false, 2), sucursal: { id: '3', nombre: 'SUC. CALLE 10' } };

  const montar = (actual: () => unknown, precios: unknown[] = [general(10, true), general(11), deSucursal]) => {
    datos = {
      guardar: vi.fn().mockReturnValue(of({})),
      paginado: vi.fn().mockReturnValue(
        of([
          { id: 1, descripcion: 'T1', activo: true },
          { id: 2, descripcion: 'T2', activo: true },
          { id: 3, descripcion: 'T3', activo: true },
        ]),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ProductoEditarService,
          useValue: {
            cargando: () => false,
            error: () => null,
            producto: () => ({ id: 1 }),
            presentaciones: () => [{ id: 2, precios }],
            cargar: vi.fn(),
            recargar: vi.fn(),
          },
        },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: { danger: vi.fn() } },
        { provide: AuthService, useValue: { sucursal: () => ({ id: 3 }), roles: () => [] } },
        { provide: SavePrecioPorSucursalGQL, useValue: {} },
        { provide: DeletePrecioPorSucursalGQL, useValue: {} },
        { provide: TipoPreciosGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
        { provide: MonedaModuloService, useValue: { monedaDe: vi.fn(async () => null) } },
        { provide: PrecioMonedaService, useValue: { cargar: () => Promise.resolve() } },
        { provide: SucursalService, useValue: { actual } },
      ],
    });
    const f = TestBed.createComponent(PreciosPage);
    f.componentRef.setInput('id', '1');
    f.componentRef.setInput('presentacionId', '2');
    f.detectChanges();
    return f;
  };

  const sucursalesGuardadas = () => datos.guardar.mock.calls.map((c) => (c[1] as { sucursalId: number }).sucursalId);

  it('los precios de la sucursal del central son editables; el de una sucursal, no', () => {
    const c = montar(() => of({ id: '0' })).componentInstance;

    expect(c.preciosEditables().map((p) => p.id)).toEqual([10, 11]);
    expect(c.preciosAjenos().map((p) => p.id)).toEqual([50]);
  });

  it('mientras no se sabe la sucursal del central, nada es editable ni se pinta como de otra sucursal', () => {
    const actual$ = new Subject<unknown>();
    const f = montar(() => actual$);
    const c = f.componentInstance;

    expect(c.cargandoSucursalCentral()).toBe(true);
    expect(c.preciosEditables()).toEqual([]);
    expect(f.nativeElement.textContent).not.toContain('Precios de una sucursal');

    actual$.next({ id: '0' });
    actual$.complete();
    expect(c.preciosEditables().length).toBe(2);
  });

  it('si no se pudo saber, nada es editable, avisa en pantalla y Reintentar lo habilita', () => {
    let falla = true;
    const f = montar(() => (falla ? throwError(() => new Error('red')) : of({ id: '0' })));
    const c = f.componentInstance;
    f.detectChanges();

    expect(c.errorSucursalCentral()).toBe(true);
    expect(c.preciosEditables()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('No se pudo saber qué precios son generales');
    expect(f.nativeElement.textContent).not.toContain('Agregar precio');

    falla = false;
    c.cargarSucursalCentral();
    f.detectChanges();
    expect(c.errorSucursalCentral()).toBe(false);
    expect(c.preciosEditables().length).toBe(2);
  });

  it('el combo de agregar no ofrece un tipo que ya tiene precio general', () => {
    const c = montar(() => of({ id: '0' })).componentInstance;

    // T1 ya está en la sucursal del central; T2 solo en una sucursal concreta.
    expect(c.tiposPrecioDisponibles().map((t) => t.id)).toEqual([2, 3]);
  });

  it('editar, activar y marcar principal mandan la sucursal del precio, no la de la sesión', () => {
    const c = montar(() => of({ id: '0' })).componentInstance;
    const [principal, otro] = c.preciosEditables();

    c.iniciarEdicion(otro);
    c.edicionValor.set(21000);
    c.guardarEdicion(otro);
    c.toggleActivo(otro);
    // Degrada el principal anterior y después guarda el nuevo: dos guardados.
    c.marcarPrincipal(otro);

    expect(principal.id).toBe(10);
    expect(sucursalesGuardadas()).toEqual([0, 0, 0, 0]);
  });

  it('agregar un precio manda la sucursal de la sesión, como el escritorio', () => {
    const c = montar(() => of({ id: '0' })).componentInstance;

    c.nuevoTipoPrecioId.set(3);
    c.nuevoMonto.set(15000);
    c.agregarPrecio();

    expect(sucursalesGuardadas()).toEqual([3]);
  });
});
