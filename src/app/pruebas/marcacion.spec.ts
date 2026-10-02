import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { GeoService } from '../core/dispositivo/geo.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import {
  AccionMarcacionPendiente,
  EstadoMarcacionUsuario,
  MarcacionInput,
  TipoMarcacion,
} from '../domains/marcacion/marcacion.model';
import { Usuario } from '../domains/personas/usuario.model';
import { MarcacionPage } from '../pages/marcacion/marcacion.page';
import { MarcacionService } from '../pages/marcacion/marcacion.service';
import { EstadoMarcacionUsuarioGQL } from '../graphql/administrativo/marcacion/estadoMarcacionUsuario';
import { SaveMarcacionGQL } from '../graphql/administrativo/marcacion/saveMarcacion';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * Las clases GQL inyectan Apollo, que acá no hace falta: lo que se prueba es
 * el manejo de `localStorage`, que no toca la red.
 */
const sinApollo = [
  { provide: SaveMarcacionGQL, useValue: {} },
  { provide: EstadoMarcacionUsuarioGQL, useValue: {} },
];

describe('Distancia a la sucursal', () => {
  let geo: GeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    geo = TestBed.inject(GeoService);
  });

  it('mide cero sobre el mismo punto', () => {
    expect(geo.distanciaMetros(-25.5, -54.6, -25.5, -54.6)).toBe(0);
  });

  it('un grado de latitud son ~111 km', () => {
    const m = geo.distanciaMetros(-25.5, -54.6, -24.5, -54.6);
    expect(m).toBeGreaterThan(110_000);
    expect(m).toBeLessThan(112_000);
  });

  it('mide decenas de metros con precisión útil', () => {
    // ~0,0009° de latitud ≈ 100 m. Es la escala que decide si alguien está
    // en la sucursal o en la vereda de enfrente.
    const m = geo.distanciaMetros(-25.5, -54.6, -25.5009, -54.6);
    expect(Math.round(m)).toBeGreaterThan(95);
    expect(Math.round(m)).toBeLessThan(105);
  });

  it('es simétrica', () => {
    const ida = geo.distanciaMetros(-25.5, -54.6, -25.51, -54.61);
    const vuelta = geo.distanciaMetros(-25.51, -54.61, -25.5, -54.6);
    expect(Math.round(ida)).toBe(Math.round(vuelta));
  });
});

/**
 * El central declara `distanciaSucursalMetros: Int` en `MarcacionInput`
 * (`marcacion.graphqls`), pero el cálculo de Haversine devuelve un decimal.
 * Mandarlo crudo hace que graphql-java rechace la mutation entera con
 * «Variable 'entity' has an invalid value: Expected type 'Int' but was
 * 'Double'» — la marcación no se registra.
 */
describe('La marcación respeta el tipo del central', () => {
  let servicio: MarcacionService;
  let enviado: Record<string, unknown> | undefined;

  const base: MarcacionInput = {
    usuarioId: 1,
    sucursalId: 3,
    tipo: TipoMarcacion.ENTRADA,
  };

  const entity = () => enviado?.['entity'] as Record<string, unknown>;

  beforeEach(() => {
    enviado = undefined;
    TestBed.configureTestingModule({
      providers: [
        ...sinApollo,
        {
          provide: DatosService,
          useValue: {
            mutar: (_gql: unknown, variables: Record<string, unknown>) => {
              enviado = variables;
              return of({});
            },
          },
        },
      ],
    });
    servicio = TestBed.inject(MarcacionService);
  });

  it('manda la distancia como entero, no como decimal', () => {
    servicio.guardar({ ...base, distanciaSucursalMetros: 656.4372911 }).subscribe();

    expect(entity()['distanciaSucursalMetros']).toBe(656);
    expect(Number.isInteger(entity()['distanciaSucursalMetros'])).toBe(true);
  });

  it('redondea, no trunca: 0,5 sube', () => {
    servicio.guardar({ ...base, distanciaSucursalMetros: 12.5 }).subscribe();

    expect(entity()['distanciaSucursalMetros']).toBe(13);
  });

  it('sin ubicación, el campo no viaja', () => {
    servicio.guardar({ ...base }).subscribe();

    expect(entity()['distanciaSucursalMetros']).toBeUndefined();
  });

  it('un valor no finito se descarta en vez de romper la mutation', () => {
    servicio.guardar({ ...base, distanciaSucursalMetros: Number.NaN }).subscribe();

    expect(entity()['distanciaSucursalMetros']).toBeUndefined();
  });

  it('no toca la precisión, que el central declara Float', () => {
    servicio.guardar({ ...base, precisionGps: 12.75 }).subscribe();

    expect(entity()['precisionGps']).toBe(12.75);
  });
});

/**
 * Caso 15.9 del plan de testeo manual.
 *
 * El central manda una acción **ambigua a propósito**: cuando ya marcaste
 * entrada y todavía no saliste a almorzar, `construirEstado()` habilita
 * `puedeMarcarSalida` **y** `puedeMarcarSalidaAlmuerzo` a la vez, y deja que
 * el cliente elija con `esSalidaAlmuerzo`. La PWA lo deducía de la acción
 * —que en ese estado siempre es `SALIDA`— así que toda primera salida del
 * día quedaba como salida de almuerzo y la jornada nunca cerraba: el
 * funcionario quedaba obligado a marcar el retorno.
 */
describe('Elegir el tipo de salida', () => {
  let servicio: {
    estado: ReturnType<typeof vi.fn>;
    guardar: ReturnType<typeof vi.fn>;
  };
  let guardado: MarcacionInput | undefined;

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';
  const botones = (f: { nativeElement: HTMLElement }) =>
    Array.from(f.nativeElement.querySelectorAll('[acciones] button')).map((b) =>
      (b.textContent ?? '').trim(),
    );

  /** El estado ambiguo: entrada marcada, almuerzo sin marcar. */
  const conEleccion: EstadoMarcacionUsuario = {
    accionPendiente: AccionMarcacionPendiente.SALIDA,
    estaEnJornada: true,
    puedeMarcarEntrada: false,
    puedeMarcarSalida: true,
    puedeMarcarSalidaAlmuerzo: true,
    puedeMarcarEntradaAlmuerzo: false,
  };

  const montar = (estado: EstadoMarcacionUsuario) => {
    servicio.estado.mockReturnValue(of(estado));
    const f = TestBed.createComponent(MarcacionPage);
    f.detectChanges();
    return f;
  };

  /** Espera a que la detección de sucursal termine y repinta. */
  const detectada = async (f: { detectChanges: () => void }) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      f.detectChanges();
    }
  };

  const tocar = async (f: { nativeElement: HTMLElement; detectChanges: () => void }, etiqueta: string) => {
    const boton = Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('[acciones] button')).find(
      (b) => (b.textContent ?? '').trim() === etiqueta,
    );
    expect(boton, `no existe el botón «${etiqueta}»`).toBeTruthy();
    boton!.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      f.detectChanges();
    }
  };

  beforeEach(() => {
    localStorage.clear();
    guardado = undefined;
    servicio = {
      estado: vi.fn(() => of(conEleccion)),
      guardar: vi.fn((input: MarcacionInput) => {
        guardado = input;
        return of({});
      }),
    };

    TestBed.configureTestingModule({
      imports: APOLLO_DE_PRUEBA,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MarcacionService, useValue: servicio },
        {
          // ⚠️ **Con `localizacion`.** Desde la issue #15 la sucursal se
          // detecta por GPS: sin coordenadas no hay sucursal detectada y los
          // botones de marcar quedan deshabilitados.
          provide: SucursalService,
          useValue: {
            todas: () =>
              of([
                {
                  id: 7,
                  nombre: 'DEPOSITO AQUARIO',
                  deposito: true,
                  activo: true,
                  localizacion: '-25.5,-54.6',
                },
              ]),
          },
        },
        {
          // Sin rostro cargado y sin avisos: lo que se prueba es qué flag viaja.
          provide: DialogoService,
          useValue: { abrir: () => Promise.resolve(null), confirmar: () => Promise.resolve(true) },
        },
        {
          // Parado sobre la sucursal: distancia cero, así que no hay aviso de
          // lejanía y lo que se prueba es el flag de la salida.
          provide: GeoService,
          useValue: {
            posicionActual: () => Promise.resolve({ latitud: -25.5, longitud: -54.6, precision: 4, lecturas: 3 }),
            distanciaMetros: () => 0,
          },
        },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(Object.assign(new Usuario(), { id: 42 }));
  });

  it('ofrece las dos salidas cuando el central habilita las dos', () => {
    const f = montar(conEleccion);

    expect(botones(f)).toEqual(['Salir a almorzar', 'Marcar salida']);
  });

  it('«Marcar salida» cierra la jornada, no manda el almuerzo', async () => {
    const f = montar(conEleccion);
    // Sin sucursal detectada el botón está deshabilitado: primero el GPS.
    await detectada(f);

    await tocar(f, 'Marcar salida');

    expect(guardado?.tipo).toBe(TipoMarcacion.SALIDA);
    expect(guardado?.esSalidaAlmuerzo).toBe(false);
  });

  it('«Salir a almorzar» sí manda el flag', async () => {
    const f = montar(conEleccion);
    await detectada(f);

    await tocar(f, 'Salir a almorzar');

    expect(guardado?.tipo).toBe(TipoMarcacion.SALIDA);
    expect(guardado?.esSalidaAlmuerzo).toBe(true);
  });

  it('no dice que «falta» una acción cuando hay dos posibles', () => {
    const f = montar(conEleccion);

    expect(texto(f)).toContain('En jornada');
    expect(texto(f)).not.toContain('falta');
  });

  it('fuera de jornada sigue habiendo un solo botón', () => {
    const f = montar({
      accionPendiente: AccionMarcacionPendiente.ENTRADA,
      estaEnJornada: false,
      puedeMarcarEntrada: true,
      puedeMarcarSalida: false,
      puedeMarcarSalidaAlmuerzo: false,
      puedeMarcarEntradaAlmuerzo: false,
    });

    expect(botones(f)).toEqual(['Marcar entrada']);
  });

  it('con el almuerzo abierto, el retorno sigue siendo la única opción', () => {
    const f = montar({
      accionPendiente: AccionMarcacionPendiente.RETORNO_ALMUERZO,
      estaEnJornada: true,
      puedeMarcarEntrada: false,
      puedeMarcarSalida: false,
      puedeMarcarSalidaAlmuerzo: false,
      puedeMarcarEntradaAlmuerzo: true,
    });

    expect(botones(f)).toEqual(['Volver del almuerzo']);
  });

  it('la salida definitiva no ofrece almuerzo', () => {
    const f = montar({
      accionPendiente: AccionMarcacionPendiente.SALIDA_DEFINITIVA,
      estaEnJornada: true,
      puedeMarcarEntrada: false,
      puedeMarcarSalida: true,
      puedeMarcarSalidaAlmuerzo: false,
      puedeMarcarEntradaAlmuerzo: false,
    });

    expect(botones(f)).toEqual(['Marcar salida']);
  });
});
