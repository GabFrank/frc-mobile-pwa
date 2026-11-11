import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { MonedaModuloService } from '../core/moneda/moneda-modulo.service';
import { MonedasSesion } from '../core/moneda/monedas-sesion';
import { Moneda } from '../domains/moneda/moneda.model';
import { monedasDePreciosDeProducto } from '../domains/moneda/precio-moneda';
import { PrecioMonedaService } from '../domains/moneda/precio-moneda.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { DeletePrecioPorSucursalGQL } from '../graphql/productos/deletePrecioPorSucursal';
import { SavePrecioPorSucursalGQL } from '../graphql/productos/savePrecioPorSucursal';
import { TipoPreciosGQL } from '../graphql/productos/tipoPrecios';
import { MonedaDePreciosDeProductoGQL } from '../graphql/operaciones/moneda/convertirPrecios';
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
        { provide: MonedaDePreciosDeProductoGQL, useValue: {} },
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
        { provide: MonedaDePreciosDeProductoGQL, useValue: {} },
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

/**
 * #137: `preciosEnOtraMoneda` trae solo los activos. La pantalla lee aparte la
 * moneda de todos los precios del producto; si no la sabe, un inactivo no se
 * edita (cargar 30.000 «guaraníes» los guardaba como 30.000 US$).
 */
describe('Moneda de los precios inactivos (#137)', () => {
  const usd = Object.assign(new Moneda(), { id: 3, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });
  const gs = Object.assign(new Moneda(), { id: 1, denominacion: 'GUARANI', simbolo: '₲', decimales: 0 });

  const precio = (id: number, activo: boolean, principal = false, tipo = 1, sucursal = '0') => ({
    id,
    precio: 4.5,
    principal,
    activo,
    tipoPrecio: { id: tipo, descripcion: 'T' + tipo },
    sucursal: { id: sucursal, nombre: sucursal === '0' ? 'SERVIDOR' : 'SUC. CALLE 10' },
  });

  const producto = (monedas: Record<number, Moneda | null>) => ({
    id: '5',
    presentaciones: [{ id: '2', precios: Object.entries(monedas).map(([id, moneda]) => ({ id, moneda })) }],
  });

  let datos: {
    guardar: ReturnType<typeof vi.fn>;
    paginado: ReturnType<typeof vi.fn>;
    consultar: ReturnType<typeof vi.fn>;
  };

  const montar = (opts: {
    precios: unknown[];
    lectura?: () => Observable<unknown>;
    soportado?: boolean;
    sesion?: Map<string, Moneda>;
  }) => {
    datos = {
      guardar: vi.fn().mockReturnValue(of({})),
      paginado: vi.fn().mockReturnValue(of([])),
      consultar: vi.fn(() => (opts.lectura ? opts.lectura() : of(null))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ProductoEditarService,
          useValue: {
            cargando: () => false,
            error: () => null,
            producto: () => ({ id: 5 }),
            presentaciones: () => [{ id: 2, precios: opts.precios }],
            cargar: vi.fn(),
            recargar: vi.fn(),
          },
        },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: { danger: vi.fn() } },
        { provide: AuthService, useValue: { sucursal: () => ({ id: 2 }), roles: () => [] } },
        { provide: SavePrecioPorSucursalGQL, useValue: {} },
        { provide: DeletePrecioPorSucursalGQL, useValue: {} },
        { provide: TipoPreciosGQL, useValue: {} },
        { provide: MonedaDePreciosDeProductoGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
        { provide: MonedaModuloService, useValue: { monedaDe: vi.fn(async () => null) } },
        { provide: PrecioMonedaService, useValue: { cargar: () => Promise.resolve() } },
        { provide: SucursalService, useValue: { actual: () => of({ id: '0' }) } },
      ],
    });
    const sesion = TestBed.inject(MonedasSesion);
    sesion.empresa.set(gs);
    sesion.catalogo.set([gs, usd]);
    sesion.preciosMonedaSoportado.set(opts.soportado ?? true);
    sesion.preciosOtraMoneda.set(opts.sesion ?? new Map());
    const f = TestBed.createComponent(PreciosPage);
    f.componentRef.setInput('id', '5');
    f.componentRef.setInput('presentacionId', '2');
    f.detectChanges();
    return f;
  };

  const monedasGuardadas = () =>
    datos.guardar.mock.calls.map((c) => (c[1] as { monedaId?: number }).monedaId);

  it('la función pura: con moneda, la moneda; sin moneda, null (la de la empresa); un id que no vino, ausente', () => {
    const m = monedasDePreciosDeProducto(producto({ 10: usd, 11: null }));
    expect(m.get('10')?.id).toBe(3);
    expect(m.get('11')).toBeNull();
    expect(m.has('12')).toBe(false);
  });

  it('un precio en dólares inactivo se muestra en US$ y al editarlo manda su moneda', () => {
    const f = montar({ precios: [precio(10, false)], lectura: () => of(producto({ 10: usd })) });
    const c = f.componentInstance;
    const p = c.preciosEditables()[0];

    expect(c.referencia(p).simbolo).toBe('US$');
    c.iniciarEdicion(p);
    c.edicionValor.set(4.6);
    c.guardarEdicion(p);

    expect(monedasGuardadas()).toEqual([3]);
  });

  it('la lectura por producto gana sobre la lista de la sesión, también en un activo', () => {
    const c = montar({
      precios: [precio(11, true)],
      sesion: new Map([['11', usd]]),
      lectura: () => of(producto({ 11: null })),
    }).componentInstance;

    expect(c.monedaGuardada(c.preciosEditables()[0])).toBeNull();
  });

  it('si la lectura falla, el inactivo no se edita; activarlo y degradarlo no mandan moneda', () => {
    let falla = true;
    const f = montar({
      precios: [precio(10, false, true), precio(11, true, false, 2)],
      sesion: new Map([['11', usd]]),
      lectura: () => (falla ? throwError(() => new Error('red')) : of(producto({ 10: usd, 11: usd }))),
    });
    f.detectChanges();
    const c = f.componentInstance;
    const [inactivo, activo] = c.preciosEditables();

    expect(c.errorMonedasDelProducto()).toBe(true);
    expect(c.monedaDesconocida(inactivo)).toBe(true);
    expect(c.monedaDesconocida(activo)).toBe(false);
    expect(f.nativeElement.textContent).toContain('Moneda sin confirmar');
    const editar = [...f.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Editar' && b.getAttribute('aria-describedby'),
    ) as HTMLButtonElement;
    expect(editar.disabled).toBe(true);

    // Ni por código: se carga un importe y no se guarda.
    c.edicionId.set(10);
    c.edicionValor.set(30000);
    c.guardarEdicion(inactivo);
    expect(datos.guardar).not.toHaveBeenCalled();

    // Activar y degradar: sin monedaId, el central conserva la guardada.
    c.toggleActivo(inactivo);
    c.marcarPrincipal(activo);
    expect(monedasGuardadas()).toEqual([undefined, undefined, 3]);

    falla = false;
    c.cargarMonedasDelProducto();
    expect(c.errorMonedasDelProducto()).toBe(false);
    expect(c.monedaDesconocida(inactivo)).toBe(false);
  });

  it('un inactivo que la lectura no trae (creado después) no se sabe', () => {
    const c = montar({ precios: [precio(12, false)], lectura: () => of(producto({ 10: usd })) }).componentInstance;

    expect(c.monedaDesconocida(c.preciosEditables()[0])).toBe(true);
  });

  it('un inactivo de una sucursal concreta sigue la misma regla en la lista de solo lectura', () => {
    const f = montar({
      precios: [precio(20, false, false, 1, '3')],
      lectura: () => throwError(() => new Error('red')),
    });
    f.detectChanges();

    expect(f.componentInstance.preciosAjenos().length).toBe(1);
    expect(f.nativeElement.textContent).toContain('Moneda sin confirmar');
  });

  it('se pide sin caché y una respuesta vieja se descarta', () => {
    const respuestas: Subject<unknown>[] = [];
    const c = montar({
      precios: [precio(10, false)],
      lectura: () => {
        const s = new Subject<unknown>();
        respuestas.push(s);
        return s;
      },
    }).componentInstance;
    c.cargarMonedasDelProducto();

    expect(datos.consultar.mock.calls.at(-1)?.[2]).toMatchObject({ gql: { fetchPolicy: 'network-only' } });
    // Llega la segunda (la vigente) y después la primera (vieja): gana la segunda.
    respuestas[1].next(producto({ 10: usd }));
    respuestas[0].next(producto({ 10: null }));
    expect(c.monedaGuardada(c.preciosEditables()[0])?.id).toBe(3);
  });

  it('con un central sin precios en moneda no se pide la lectura y nada cambia', () => {
    const c = montar({ precios: [precio(10, false)], soportado: false }).componentInstance;

    expect(datos.consultar).not.toHaveBeenCalled();
    expect(c.monedaDesconocida(c.preciosEditables()[0])).toBe(false);
  });
});

