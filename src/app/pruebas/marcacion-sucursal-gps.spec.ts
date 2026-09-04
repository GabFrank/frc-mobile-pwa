import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { GeoService } from '../core/dispositivo/geo.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import {
  AccionMarcacionPendiente,
  EstadoMarcacionUsuario,
  MarcacionInput,
} from '../domains/marcacion/marcacion.model';
import { Usuario } from '../domains/personas/usuario.model';
import { MarcacionPage } from '../pages/marcacion/marcacion.page';
import { MarcacionService } from '../pages/marcacion/marcacion.service';
import {
  coordenadasDe,
  detectarSucursal,
  SucursalUbicable,
} from '../pages/marcacion/deteccion-sucursal.util';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * La sucursal de una marcación sale de la posición, no de una lista.
 *
 * Elegirla de un desplegable vaciaba de sentido a la distancia: alcanzaba con
 * seleccionar la sucursal donde uno *dice* estar. Ver la issue #15.
 */

/** Punto de referencia. ~0,0009° de latitud son ~100 m. */
const AQUI = { latitud: -25.5, longitud: -54.6 };

/** Devuelve la localización de una sucursal a `metros` al sur de {@link AQUI}. */
function aMetros(metros: number): string {
  return `${AQUI.latitud - (metros * 0.0009) / 100},${AQUI.longitud}`;
}

function sucursal(parcial: Partial<SucursalUbicable>): SucursalUbicable {
  return { id: 1, nombre: 'SUC', deposito: true, activo: true, ...parcial };
}

describe('Coordenadas de una sucursal', () => {
  it('lee el "lat,lng" que guarda el central', () => {
    expect(coordenadasDe('-25.5,-54.6')).toEqual({ lat: -25.5, lng: -54.6 });
  });

  it('tolera los espacios que el dato trae cargado a mano', () => {
    expect(coordenadasDe(' -25.5 , -54.6 ')).toEqual({ lat: -25.5, lng: -54.6 });
  });

  it('sin localización no hay coordenadas', () => {
    expect(coordenadasDe(null)).toBeNull();
    expect(coordenadasDe(undefined)).toBeNull();
    expect(coordenadasDe('')).toBeNull();
  });

  it('un texto que no son coordenadas se descarta, no se interpreta', () => {
    expect(coordenadasDe('atrás del depósito')).toBeNull();
  });

  it('media coordenada no es una coordenada', () => {
    // Un `-25.5` suelto con un `NaN` de longitud ubicaría la sucursal en
    // cualquier lado; peor que no tener el dato.
    expect(coordenadasDe('-25.5')).toBeNull();
  });
});

describe('Detectar la sucursal por la posición', () => {
  let distancia: (latA: number, lngA: number, latB: number, lngB: number) => number;

  beforeEach(() => {
    // El haversine real, no un doble: lo que se prueba es qué sucursal gana
    // con distancias de verdad.
    const geo = new GeoService();
    distancia = geo.distanciaMetros.bind(geo);
  });

  it('elige la más cercana', () => {
    const cerca = sucursal({ id: 3, nombre: 'SUC. ROTONDA', localizacion: aMetros(50) });
    const lejos = sucursal({ id: 4, nombre: 'SUC. KM 7', localizacion: aMetros(5000) });

    const detectada = detectarSucursal([lejos, cerca], AQUI, distancia);

    expect(detectada?.sucursal.id).toBe(3);
  });

  it('informa a qué distancia quedó', () => {
    const cerca = sucursal({ id: 3, localizacion: aMetros(50) });

    const detectada = detectarSucursal([cerca], AQUI, distancia);

    expect(Math.round(detectada!.metros)).toBeGreaterThan(45);
    expect(Math.round(detectada!.metros)).toBeLessThan(55);
  });

  it('una sucursal sin depósito no se elige, aunque esté encima', () => {
    // `SERVIDOR` y `COMPRAS` son virtuales y comparten las coordenadas del
    // central: sin este filtro se llevarían todas las marcaciones.
    const virtual = sucursal({ id: 0, nombre: 'SERVIDOR', deposito: false, localizacion: aMetros(1) });
    const real = sucursal({ id: 3, nombre: 'SUC. ROTONDA', localizacion: aMetros(200) });

    const detectada = detectarSucursal([virtual, real], AQUI, distancia);

    expect(detectada?.sucursal.id).toBe(3);
  });

  it('una sucursal cerrada no se elige, aunque esté encima', () => {
    const cerrada = sucursal({ id: 9, nombre: 'SUC. VIEJA', activo: false, localizacion: aMetros(1) });
    const abierta = sucursal({ id: 3, localizacion: aMetros(200) });

    const detectada = detectarSucursal([cerrada, abierta], AQUI, distancia);

    expect(detectada?.sucursal.id).toBe(3);
  });

  it('una sucursal sin coordenadas no compite', () => {
    const sinCoords = sucursal({ id: 7, localizacion: null });
    const conCoords = sucursal({ id: 3, localizacion: aMetros(800) });

    const detectada = detectarSucursal([sinCoords, conCoords], AQUI, distancia);

    expect(detectada?.sucursal.id).toBe(3);
  });

  it('si ninguna tiene coordenadas, no se detecta nada', () => {
    const sinCoords = sucursal({ id: 7, localizacion: null });

    expect(detectarSucursal([sinCoords], AQUI, distancia)).toBeNull();
  });

  it('sin sucursales, no se detecta nada', () => {
    expect(detectarSucursal([], AQUI, distancia)).toBeNull();
  });

  it('la más cercana se elige aunque quede lejos: la distancia se informa, no bloquea', () => {
    // El corte por radio es decisión de la pantalla, que avisa y deja marcar.
    // Devolver `null` acá convertiría un GPS malo en «no podés marcar».
    const unica = sucursal({ id: 3, localizacion: aMetros(4000) });

    const detectada = detectarSucursal([unica], AQUI, distancia);

    expect(detectada?.sucursal.id).toBe(3);
    expect(Math.round(detectada!.metros)).toBeGreaterThan(3900);
  });
});

/**
 * La pantalla de marcación, sin desplegable.
 *
 * Lo que se prueba acá es la consecuencia operativa de la issue #15: que la
 * sucursal salga de la posición, que sin posición no se marque, y que la
 * evidencia que viaja con la marcación sea la del momento de marcar y no la
 * de cuando se abrió la pantalla.
 */
describe('Marcación: la sucursal sale del GPS', () => {
  /** Sobre la sucursal misma. */
  const AQUI_CERCA = { latitud: -25.5, longitud: -54.6, precision: 4, lecturas: 3 };
  /** ~5 km al sur: ahí la más cercana es la otra. */
  const AQUI_LEJOS = { latitud: -25.545, longitud: -54.6, precision: 4, lecturas: 3 };

  const ROTONDA = {
    id: 3,
    nombre: 'SUC. ROTONDA',
    deposito: true,
    activo: true,
    localizacion: '-25.5,-54.6',
  };
  const KM7 = {
    id: 4,
    nombre: 'SUC. KM 7',
    deposito: true,
    activo: true,
    localizacion: '-25.545,-54.6',
  };

  const enJornada: EstadoMarcacionUsuario = {
    accionPendiente: AccionMarcacionPendiente.ENTRADA,
    estaEnJornada: false,
    puedeMarcarEntrada: true,
    puedeMarcarSalida: false,
    puedeMarcarSalidaAlmuerzo: false,
    puedeMarcarEntradaAlmuerzo: false,
  };

  let servicio: { estado: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let guardado: MarcacionInput | undefined;
  let posicion: { latitud: number; longitud: number; precision: number; lecturas: number } | null;
  let pedidosDePosicion: number;
  let sucursales: unknown[];

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const botonMarcar = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelector<HTMLButtonElement>('[acciones] button');

  /**
   * Vacía la cadena de promesas y repinta.
   *
   * ⚠️ **Un solo `setTimeout(0)` no alcanza.** Marcar encadena varios `await`
   * —el diálogo facial, la posición, la confirmación— y con un tick el test
   * termina antes de que la marcación se mande: pasaba en verde sin que el
   * código hiciera nada.
   */
  const asentar = async (f: { detectChanges: () => void }) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      f.detectChanges();
    }
  };

  const montar = async () => {
    const f = TestBed.createComponent(MarcacionPage);
    f.detectChanges();
    await asentar(f);
    return f;
  };

  const tocarPorTexto = async (
    f: { nativeElement: HTMLElement; detectChanges: () => void },
    etiqueta: string,
  ) => {
    const boton = Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.textContent ?? '').trim() === etiqueta,
    );
    expect(boton, `no existe el botón «${etiqueta}»`).toBeTruthy();
    boton!.click();
    await asentar(f);
  };

  beforeEach(() => {
    localStorage.clear();
    guardado = undefined;
    posicion = AQUI_CERCA;
    pedidosDePosicion = 0;
    sucursales = [KM7, ROTONDA];

    servicio = {
      estado: vi.fn(() => of(enJornada)),
      guardar: vi.fn((input: MarcacionInput) => {
        guardado = input;
        return of({});
      }),
    };

    const haversine = new GeoService();

    TestBed.configureTestingModule({
      imports: APOLLO_DE_PRUEBA,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MarcacionService, useValue: servicio },
        { provide: SucursalService, useValue: { todas: () => of(sucursales) } },
        {
          // Sin rostro cargado, y todo lo que se pregunte se responde que sí:
          // lo que se prueba es la sucursal, no la cara ni los avisos.
          provide: DialogoService,
          useValue: { abrir: () => Promise.resolve(null), confirmar: () => Promise.resolve(true) },
        },
        {
          provide: GeoService,
          useValue: {
            posicionActual: () => {
              pedidosDePosicion++;
              return Promise.resolve(posicion);
            },
            distanciaMetros: haversine.distanciaMetros.bind(haversine),
          },
        },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(Object.assign(new Usuario(), { id: 42 }));
  });

  it('al abrir, muestra la sucursal detectada', async () => {
    const f = await montar();

    expect(texto(f)).toContain('SUC. ROTONDA');
  });

  it('no hay desplegable para elegir la sucursal', async () => {
    const f = await montar();

    expect(f.nativeElement.querySelector('frc-selector')).toBeNull();
  });

  it('detecta la sucursal sin que nadie toque nada', async () => {
    await montar();

    expect(pedidosDePosicion).toBe(1);
  });

  it('parado en la otra punta, detecta la otra sucursal', async () => {
    posicion = AQUI_LEJOS;

    const f = await montar();

    expect(texto(f)).toContain('SUC. KM 7');
  });

  it('sin ubicación no se marca', async () => {
    posicion = null;

    const f = await montar();

    expect(botonMarcar(f)?.disabled).toBe(true);
  });

  it('sin ubicación lo dice, en vez de fallar callado', async () => {
    posicion = null;

    const f = await montar();

    expect(texto(f)).toContain('No se pudo obtener la ubicación');
  });

  it('sin ubicación no cae a la sucursal de la sesión', async () => {
    posicion = null;

    const f = await montar();

    // Caer en silencio a una sucursal cualquiera es justamente el bug: la
    // distancia deja de medir nada porque se mide contra la que se eligió.
    // Se mira la sucursal detectada y no solo la pantalla, porque una que
    // quedara puesta sin mostrarse igual viajaría con la marcación.
    expect(f.componentInstance.sucursalDetectada()).toBeNull();
    expect(texto(f)).not.toContain('SUC.');
  });

  it('«ninguna sucursal tiene coordenadas» es una respuesta distinta de «no hay GPS»', async () => {
    sucursales = [{ id: 3, nombre: 'SUC. ROTONDA', deposito: true, activo: true, localizacion: null }];

    const f = await montar();

    expect(texto(f)).toContain('No se pudo determinar la sucursal');
    expect(texto(f)).not.toContain('No se pudo obtener la ubicación');
  });

  it('Recalcular vuelve a pedir la posición', async () => {
    posicion = null;
    const f = await montar();
    posicion = AQUI_CERCA;

    await tocarPorTexto(f, 'Recalcular');

    expect(texto(f)).toContain('SUC. ROTONDA');
  });

  it('al marcar, la evidencia es la posición del momento y no la de la apertura', async () => {
    const f = await montar();
    // La persona se mueve entre que abrió la pantalla y que marca.
    posicion = { ...AQUI_CERCA, latitud: -25.5005, precision: 9 };

    await tocarPorTexto(f, 'Marcar entrada');

    expect(pedidosDePosicion).toBe(2);
    expect(guardado?.latitud).toBe(-25.5005);
    expect(guardado?.precisionGps).toBe(9);
  });

  it('marca contra la sucursal detectada, no contra la de la sesión', async () => {
    const f = await montar();

    await tocarPorTexto(f, 'Marcar entrada');

    expect(guardado?.sucursalId).toBe(3);
  });

  it('si al marcar la sucursal más cercana cambió, no marca contra la vieja', async () => {
    const f = await montar();
    posicion = AQUI_LEJOS;

    await tocarPorTexto(f, 'Marcar entrada');

    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(texto(f)).toContain('SUC. KM 7');
  });

  it('si al marcar se pierde la ubicación, no se marca igual', async () => {
    const f = await montar();
    posicion = null;

    await tocarPorTexto(f, 'Marcar entrada');

    expect(servicio.guardar).not.toHaveBeenCalled();
    // Y la pantalla queda usable: si `marcando` se traba en true, el botón
    // se queda en «Marcando…» para siempre y hay que recargar la app.
    expect(f.componentInstance.marcando()).toBe(false);
    expect(f.componentInstance.deteccion()).toBe('sin-posicion');
  });
});
