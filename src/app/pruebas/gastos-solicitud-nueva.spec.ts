import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { GastosService } from '../pages/operaciones/gastos/gastos.service';
import { GastosSolicitudNuevaPage } from '../pages/operaciones/gastos/gastos-solicitud-nueva.page';

const TIPOS = [
  { id: 1, descripcion: 'VIÁTICO', moduloPadre: 'PERSONAS', tipoNaturaleza: 'VARIABLE' },
  { id: 2, descripcion: 'COMBUSTIBLE', moduloPadre: 'VEHICULO', tipoNaturaleza: 'VARIABLE' },
  { id: 3, descripcion: 'LUZ', moduloPadre: 'ANDE', tipoNaturaleza: 'RECURRENTE' },
];

const MONEDAS = [
  { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
  { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
];

const SUCURSALES = [
  { id: 1, nombre: 'SUC. CENTRAL', activo: true, deposito: { id: 1 } },
  // Sin depósito: es virtual para stock, pero una caja chica se retira igual.
  { id: 9, nombre: 'COMPRAS', activo: true, deposito: null },
];

// Compartidos entre las dos `describe`: la Task 8 reusa el `beforeEach` de
// la Task 7 en vez de duplicarlo.
let gastos: Record<string, ReturnType<typeof vi.fn>>;

const montar = () => {
  const fixture = TestBed.createComponent(GastosSolicitudNuevaPage);
  fixture.detectChanges();
  return fixture;
};

const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

beforeEach(() => {
  localStorage.clear();
  gastos = {
    tiposDeGasto: vi.fn(() => of(TIPOS)),
    monedas: vi.fn(() => of(MONEDAS)),
    formasPago: vi.fn(() => of([{ id: 1, descripcion: 'EFECTIVO' }])),
    resolverEnte: vi.fn(async () => ({ id: 50 })),
    resumenDelEnte: vi.fn(() => of({})),
    crearSolicitud: vi.fn(() => of({ id: 2338, sucursalId: 1 })),
    buscarVehiculos: vi.fn(async () => ({ items: [], hayMas: false })),
    buscarInmuebles: vi.fn(async () => ({ items: [], hayMas: false })),
    buscarMuebles: vi.fn(async () => ({ items: [], hayMas: false })),
    buscarEquipos: vi.fn(async () => ({ items: [], hayMas: false })),
    buscarPersonas: vi.fn(async () => ({ items: [], hayMas: false })),
    buscarProveedores: vi.fn(async () => ({ items: [], hayMas: false })),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: GastosService, useValue: gastos },
      // Las sucursales no pasan por GastosService: la pantalla usa el
      // servicio que ya existe, como recepcion-nueva.page.ts.
      { provide: SucursalService, useValue: { todas: () => of(SUCURSALES) } },
    ],
  });
  // La sucursal sale de la sesión: no existe «entrar a una sucursal».
  TestBed.inject(AuthService).establecerUsuario({
    id: 7,
    persona: { id: 41, nombre: 'MAURO LANDO' },
    inicioSesion: { sucursal: SUCURSALES[0] },
  } as never);
});

describe('Alta de solicitud de caja chica', () => {
  it('muestra el esqueleto mientras los catálogos no llegaron', () => {
    // Un selector de tipo de gasto vacío no se distingue de «no hay tipos de
    // gasto». Mientras no hay respuesta, esqueleto.
    //
    // ⚠️ `NEVER`, no `of([])`: `of` emite en el mismo tick, la carga
    // terminaría antes del primer `detectChanges` y el test miraría un
    // estado que ya pasó — pasaría o fallaría por la razón equivocada.
    gastos['tiposDeGasto'].mockReturnValue(NEVER);
    const fixture = montar();

    expect(fixture.nativeElement.querySelector('frc-skeleton')).not.toBeNull();
  });

  it('ofrece reintentar cuando la carga de catálogos falla', () => {
    // frc-mobile silencia este fallo con un catch vacío y deja los selectores
    // vacíos: el formulario parece cargado y no lo está.
    gastos['tiposDeGasto'].mockReturnValue(throwError(() => new Error('central caído')));
    const fixture = montar();

    expect(fixture.nativeElement.querySelector('frc-estado-error')).not.toBeNull();
    expect(texto(fixture)).not.toContain('Seleccionar tipo de gasto');
  });

  it('toma la sucursal de la sesión como valor por defecto', () => {
    const fixture = montar();

    expect(fixture.componentInstance.sucursalId()).toBe(1);
  });

  it('ofrece también las sucursales sin depósito', () => {
    // `soloOperables()` es para lo que mueve stock. Filtrar acá dejaría al
    // operador de COMPRAS sin poder pedir plata.
    const fixture = montar();

    expect(fixture.componentInstance.sucursales().map((s) => s.id)).toEqual([1, 9]);
  });

  it('no ofrece la sucursal SERVIDOR, que tiene id 0', () => {
    // El central rechaza `sucursalId <= 0` al guardar (`PreGastoGraphQL.java`:
    // «Debe indicar una sucursal válida para registrar la solicitud.»).
    // Antes la pantalla la dejaba elegir —`faltaParaGuardar` la aceptaba
    // porque `0` es "falsy" y el chequeo usa `== null`— y el operador recién
    // se enteraba del rechazo después de llenar todo el formulario y tocar
    // Guardar. Ahora ni aparece en el selector.
    //
    // `overrideProvider` no sirve acá: el módulo ya se instanció en el
    // `beforeEach` al pedir `AuthService`. Se reconfigura entero, como el
    // `beforeEach`, con SERVIDOR como única sucursal que devuelve el central.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GastosService, useValue: gastos },
        {
          provide: SucursalService,
          useValue: {
            todas: () => of([{ id: 0, nombre: 'SERVIDOR', activo: true, deposito: null }]),
          },
        },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario({
      id: 7,
      persona: { id: 41, nombre: 'MAURO LANDO' },
      inicioSesion: { sucursal: SUCURSALES[0] },
    } as never);
    const fixture = montar();

    // Sin sucursales ofrecibles, no hay valor por defecto y el formulario
    // queda pidiendo una — el mismo mensaje que si el central no devolviera
    // ninguna sucursal.
    expect(fixture.componentInstance.sucursales()).toEqual([]);
    expect(fixture.componentInstance.sucursalId()).toBeNull();
    expect(fixture.componentInstance.falta()).toBe('Seleccione una sucursal de retiro');
  });

  it('muestra el responsable de la sesión y no lo deja elegir', () => {
    // El retiro se imputa a la persona, no al usuario.
    const fixture = montar();

    expect(texto(fixture)).toContain('MAURO LANDO');
    expect(fixture.componentInstance.responsableId()).toBe(41);
  });
});

describe('Alta de solicitud — el activo imputado', () => {
  it('no pide activo para un tipo de gasto de PERSONAS', () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[0]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requiereActivo()).toBe(false);
  });

  it('pide un vehículo cuando el módulo padre es VEHICULO', () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requiereActivo()).toBe(true);
    expect(fixture.componentInstance.etiquetaActivo()).toBe('Vehículo');
  });

  it('pide un inmueble para ANDE, y lo llama «Inmueble (ANDE)»', () => {
    // Los siete servicios continuos se imputan a un inmueble: la luz la
    // consume un local. «Inmueble» a secas no distingue el de la luz del
    // del agua.
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.detectChanges();

    expect(fixture.componentInstance.etiquetaActivo()).toBe('Inmueble (ANDE)');
  });

  it('limpia el activo elegido al cambiar de tipo de gasto', async () => {
    // Un vehículo quedaría imputado a un gasto de inmueble: el gasto termina
    // contra el activo equivocado y nadie lo nota.
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();
    expect(fixture.componentInstance.enteId()).toBe(50);

    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.detectChanges();

    expect(fixture.componentInstance.enteId()).toBeNull();
    expect(fixture.componentInstance.vistaResumen()).toBeNull();
  });

  it('un segundo activo que falla al resolver el Ente no deja imputado el primero', async () => {
    // El defecto: elegir el vehículo A (enteId 50) y que falle el resolverEnte
    // del vehículo B dejaba enteId en 50 — la pantalla mostraba «B» y
    // guardaba contra «A», con Guardar habilitado.
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'AAA111' });
    fixture.detectChanges();
    expect(fixture.componentInstance.enteId()).toBe(50);

    gastos['resolverEnte'].mockRejectedValueOnce(new Error('sin red'));
    await fixture.componentInstance.elegirActivo({ id: 99, chapa: 'BBB222' });
    fixture.detectChanges();

    expect(fixture.componentInstance.enteId()).toBeNull();
    expect(fixture.componentInstance.errorResumen()).toBe(true);
    expect(fixture.componentInstance.falta()).not.toBeNull();
  });

  it('un resumen sin datos (`{}`) no afirma que no se debe nada', async () => {
    // El mock por defecto de `resumenDelEnte` es `of({})`: con todos los
    // campos nullables del central, eso es «no lo informó», no «deuda cero».
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Sin datos del central');
    expect(texto(fixture)).not.toContain('₲ 0');
  });

  it('dice «No se pudo consultar el activo» cuando el resumen falla', async () => {
    // Nunca montos en cero: un cero afirma que no se debe nada, y eso no lo
    // dijo nadie.
    gastos['resumenDelEnte'].mockReturnValue(throwError(() => new Error('sin red')));
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();

    expect(fixture.componentInstance.errorResumen()).toBe(true);
    expect(texto(fixture)).toContain('No se pudo consultar el activo');
    expect(texto(fixture)).not.toContain('₲ 0');
  });

  it('dice «No se pudo consultar el activo» cuando el resumen llega null', async () => {
    // `data: null` es una respuesta GraphQL válida, no un error de red —
    // `DatosService.consultar` no la envuelve en el canal de error (Task 6
    // ya lo prueba para `resolverEnte`). El mismo aviso tiene que salir acá,
    // y nunca un monto en cero.
    gastos['resumenDelEnte'].mockReturnValue(of(null));
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();

    expect(fixture.componentInstance.errorResumen()).toBe(true);
    expect(fixture.componentInstance.vistaResumen()).toBeNull();
    expect(texto(fixture)).toContain('No se pudo consultar el activo');
    expect(texto(fixture)).not.toContain('₲ 0');
  });

  it('autocompleta el primer detalle vacío al elegir el activo', async () => {
    gastos['resumenDelEnte'].mockReturnValue(
      of({ montoSugerido: 450000, monedaId: 1, autocompletarMonto: true }),
    );
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    await fixture.componentInstance.elegirActivo({ id: 12, nombreAsignado: 'LOCAL 3' });
    fixture.detectChanges();

    expect(fixture.componentInstance.detalles()[0].monto).toBe(450000);
    expect(fixture.componentInstance.detalles()[0].monedaId).toBe(1);
  });

  it('NO pisa el monto que el operador ya había cargado', async () => {
    // Es el apartamiento deliberado de frc-mobile: allá, cambiar de activo
    // borraba sin aviso lo tipeado.
    gastos['resumenDelEnte'].mockReturnValue(
      of({ montoSugerido: 450000, monedaId: 1, autocompletarMonto: true }),
    );
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.componentInstance.cambiarDetalle(0, { monto: 99000, monedaId: 2 });
    await fixture.componentInstance.elegirActivo({ id: 12, nombreAsignado: 'LOCAL 3' });
    fixture.detectChanges();

    expect(fixture.componentInstance.detalles()[0].monto).toBe(99000);
    expect(fixture.componentInstance.detalles()[0].monedaId).toBe(2);
  });

  it('elige el buscador que corresponde al módulo padre', async () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);

    // ANDE es un servicio continuo: el buscador es el de inmuebles, no uno
    // propio del módulo. `configBuscadorActivo()` es la construcción de la
    // config extraída de `abrirBuscadorActivo()` — probarla acá no depende
    // de que un diálogo real de Material se abra y resuelva en jsdom.
    const config = fixture.componentInstance.configBuscadorActivo();
    expect(config?.modo).toBe('paginado');
    await config?.cargarPagina('', 0);

    expect(gastos['buscarInmuebles']).toHaveBeenCalled();
    expect(gastos['buscarVehiculos']).not.toHaveBeenCalled();
  });

  it('el proveedor que trae el resumen del activo pisa el beneficiario elegido a mano', async () => {
    // Decisión deliberada, portada del spec de frc-mobile: en un gasto
    // recurrente el central ya sabe a quién se le paga — ANDE, por ejemplo—
    // y ese proveedor manda sobre lo que el operador haya tocado antes en
    // el buscador de beneficiario.
    gastos['resumenDelEnte'].mockReturnValue(
      of({ proveedorId: 77, proveedorNombre: 'ande s.a.' }),
    );
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.componentInstance.elegirProveedor({
      id: 5,
      persona: { nombre: 'PROVEEDOR ELEGIDO A MANO' },
    } as never);

    await fixture.componentInstance.elegirActivo({ id: 12, nombreAsignado: 'LOCAL 3' });
    fixture.detectChanges();

    expect(fixture.componentInstance.beneficiarioTipo()).toBe('PROVEEDOR');
    expect(fixture.componentInstance.beneficiarioProveedorId()).toBe(77);
    expect(texto(fixture)).toContain('ANDE S.A.');
    expect(texto(fixture)).not.toContain('PROVEEDOR ELEGIDO A MANO');
  });
});

describe('Alta de solicitud — montos y guardado', () => {
  const completar = (fixture: ReturnType<typeof montar>) => {
    fixture.componentInstance.elegirTipoGasto(TIPOS[0]);
    fixture.componentInstance.elegirProveedor({
      id: 33,
      persona: { nombre: 'DIST. ESTE' },
    } as never);
    fixture.componentInstance.cambiarDetalle(0, {
      monto: 500000,
      monedaId: 1,
      formaPago: 'EFECTIVO',
    });
    fixture.detectChanges();
  };

  it('arranca con un detalle y deja agregar otro', () => {
    const fixture = montar();
    expect(fixture.componentInstance.detalles()).toHaveLength(1);

    fixture.componentInstance.agregarDetalle();
    expect(fixture.componentInstance.detalles()).toHaveLength(2);
  });

  it('no deja quitar el último detalle', () => {
    const fixture = montar();
    fixture.componentInstance.quitarDetalle(0);

    expect(fixture.componentInstance.detalles()).toHaveLength(1);
  });

  it('muestra el total en guaraníes sin decimales', () => {
    // El guaraní no lleva decimales, y la denominación es lo que lo decide.
    const fixture = montar();
    fixture.componentInstance.cambiarDetalle(0, {
      monto: 1500000,
      monedaId: 1,
      formaPago: 'EFECTIVO',
    });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('1.500.000');
    expect(texto(fixture)).not.toContain('1.500.000,00');
  });

  it('arma el total con la denominación aunque las monedas lleguen con id string', () => {
    // GraphQL serializa `ID` como string: el central real devuelve
    // `{ id: "1", denominacion: "GUARANI", simbolo: "Gs." }`. Con la
    // comparación vieja (`m.id === monedaId`, número contra string) la fila
    // de totales mostraba «Total : 5.000.000,00» — sin nombre de moneda y
    // con decimales, porque no encontraba el guaraní.
    gastos['monedas'].mockReturnValue(
      of([{ id: '1', denominacion: 'GUARANI', simbolo: 'Gs.' }]),
    );
    const fixture = montar();
    fixture.componentInstance.cambiarDetalle(0, {
      monto: 5000000,
      monedaId: 1,
      formaPago: 'EFECTIVO',
    });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Total GUARANI: Gs. 5.000.000');
    expect(texto(fixture)).not.toContain('Total : Gs. 5.000.000,00');
  });

  it('bloquea el guardado y dice qué falta', () => {
    const fixture = montar();
    fixture.detectChanges();

    expect(fixture.componentInstance.falta()).toBe('Seleccione un tipo de gasto');
    expect(gastos['crearSolicitud']).not.toHaveBeenCalled();
  });

  it('avisa cuando se repite la moneda entre detalles', () => {
    const fixture = montar();
    completar(fixture);
    fixture.componentInstance.agregarDetalle();
    fixture.componentInstance.cambiarDetalle(1, {
      monto: 100,
      monedaId: 1,
      formaPago: 'TRANSFERENCIA',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.falta()).toBe(
      'No repita la misma moneda en más de un detalle',
    );
  });

  it('navega al detalle de la solicitud creada, donde está el QR', async () => {
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = montar();
    completar(fixture);

    await fixture.componentInstance.guardar();

    // El detalle se resuelve por id **y** sucursal: sin los dos no encuentra
    // la solicitud.
    expect(navegar).toHaveBeenCalledWith(['/operaciones/gastos', 2338, 1]);
  });

  it('se queda en el formulario si el guardado falla', async () => {
    // Navegar igual perdería una carga entera.
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    gastos['crearSolicitud'].mockReturnValue(throwError(() => new Error('rechazado')));
    const fixture = montar();
    completar(fixture);

    await fixture.componentInstance.guardar();

    expect(navegar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.guardando()).toBe(false);
    expect(fixture.componentInstance.detalles()[0].monto).toBe(500000);
  });
});
