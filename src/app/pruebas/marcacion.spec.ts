import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { GeoService } from '../core/dispositivo/geo.service';
import { MarcacionService } from '../pages/marcacion/marcacion.service';
import { EstadoMarcacionUsuarioGQL } from '../graphql/administrativo/marcacion/estadoMarcacionUsuario';
import { SaveMarcacionGQL } from '../graphql/administrativo/marcacion/saveMarcacion';
import { horariosDeJornada } from '../domains/marcacion/jornada.util';
import { Jornada, TipoMarcacion } from '../domains/marcacion/marcacion.model';
import { horaLegible } from '../generic/utils/dateUtils';

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

describe('Sucursal persistida de marcación', () => {
  let servicio: MarcacionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: sinApollo });
    servicio = TestBed.inject(MarcacionService);
  });

  it('guarda y recuerda la elegida', () => {
    servicio.guardarSucursal({ id: 3, nombre: 'SUC. ROTONDA' } as never);
    expect(servicio.sucursalPersistida()?.id).toBe(3);
  });

  it('guardar null la borra, sin dejar la cadena "null"', () => {
    servicio.guardarSucursal({ id: 3 } as never);
    servicio.guardarSucursal(null);

    expect(servicio.sucursalPersistida()).toBeNull();
    // Es el bug #4 del TODO del repo anterior: `setItem(clave, null)` persiste
    // el texto "null", que después se lee como un valor válido.
    expect(localStorage.getItem('frc.marcacion.sucursal')).toBeNull();
  });

  it('un dato corrupto se limpia en vez de arrastrarse', () => {
    localStorage.setItem('frc.marcacion.sucursal', '{no es json');
    // Se relee al construir el servicio.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: sinApollo });
    const otro = TestBed.inject(MarcacionService);

    expect(otro.sucursalPersistida()).toBeNull();
    expect(localStorage.getItem('frc.marcacion.sucursal')).toBeNull();
  });
});

describe('Horarios de una jornada', () => {
  /*
    Ninguna hora se repite entre campos a propósito: si la regla leyera un
    campo por otro —`fechaSalida` donde va `fechaEntrada`, el almuerzo donde
    va la salida— el test lo delata en vez de pasar de casualidad.
  */
  const jornadaCompleta = (): Jornada => ({
    id: 1,
    fecha: '2026-08-14',
    marcacionEntrada: { id: 11, tipo: TipoMarcacion.ENTRADA, fechaEntrada: '2026-08-14 07:12' },
    marcacionSalidaAlmuerzo: { id: 12, tipo: TipoMarcacion.SALIDA, fechaSalida: '2026-08-14 12:03' },
    marcacionEntradaAlmuerzo: { id: 13, tipo: TipoMarcacion.ENTRADA, fechaEntrada: '2026-08-14 13:21' },
    marcacionSalida: { id: 14, tipo: TipoMarcacion.SALIDA, fechaSalida: '2026-08-14 17:45' },
  });

  it('devuelve los cuatro fichajes en el orden en que ocurrieron', () => {
    expect(horariosDeJornada(jornadaCompleta()).map((h) => h.hora)).toEqual([
      '07:12',
      '12:03',
      '13:21',
      '17:45',
    ]);
  });

  it('lee la salida de `fechaSalida` y la entrada de `fechaEntrada`', () => {
    // Es la trampa del modelo: una marcación no tiene un campo "fecha", y
    // mirar siempre el mismo deja la mitad de los fichajes sin hora.
    const horarios = horariosDeJornada(jornadaCompleta());
    expect(horarios.find((h) => h.clave === 'entrada')?.hora).toBe('07:12');
    expect(horarios.find((h) => h.clave === 'salida')?.hora).toBe('17:45');
  });

  it('omite los fichajes que no ocurrieron, en vez de mostrarlos vacíos', () => {
    // Jornada abierta: entró y todavía no salió.
    const abierta: Jornada = {
      id: 2,
      fecha: '2026-08-14',
      marcacionEntrada: { id: 21, tipo: TipoMarcacion.ENTRADA, fechaEntrada: '2026-08-14 08:31' },
    };
    expect(horariosDeJornada(abierta).map((h) => h.clave)).toEqual(['entrada']);
  });

  it('marca el día cuando la salida cae después de la medianoche', () => {
    // Turno noche: sin el día, una salida a las 05:40 se leería como una
    // salida de madrugada del mismo día que la entrada.
    const noche: Jornada = {
      id: 3,
      fecha: '2026-08-14',
      marcacionEntrada: { id: 31, tipo: TipoMarcacion.ENTRADA, fechaEntrada: '2026-08-14 21:58' },
      marcacionSalida: { id: 32, tipo: TipoMarcacion.SALIDA, fechaSalida: '2026-08-15 05:40' },
    };
    const horarios = horariosDeJornada(noche);
    expect(horarios[0].hora).toBe('21:58');
    expect(horarios[1].hora).toBe('05:40 (15/08)');
  });

  it('una marcación con el campo cruzado igual muestra su hora', () => {
    // Una salida reprocesada puede quedar con el momento en `fechaEntrada`.
    // El central usa el otro campo como respaldo al imprimir el reporte, y
    // acá se hace lo mismo: perder la hora sería peor que mostrarla.
    const cruzada: Jornada = {
      id: 4,
      fecha: '2026-08-14',
      marcacionSalida: { id: 41, tipo: TipoMarcacion.SALIDA, fechaEntrada: '2026-08-14 18:09' },
    };
    expect(horariosDeJornada(cruzada)[0].hora).toBe('18:09');
  });

  it('sin jornada no inventa filas', () => {
    expect(horariosDeJornada(null)).toEqual([]);
    expect(horariosDeJornada({ id: 5, fecha: '2026-08-14' })).toEqual([]);
  });
});

describe('Hora legible', () => {
  it('devuelve solo la hora de lo que el central manda con hora', () => {
    expect(horaLegible('2026-08-14 09:30')).toBe('09:30');
  });

  it('un valor sin hora devuelve null, no 00:00', () => {
    // El central manda `yyyy-MM-dd` para lo que ocurre en un día. Inventar
    // medianoche diría que alguien fichó a las cero horas.
    expect(horaLegible('2026-08-14')).toBeNull();
  });

  it('la época Unix es una fecha ausente, no una hora', () => {
    expect(horaLegible('1970-01-01 00:00')).toBeNull();
  });

  it('sin valor no rompe', () => {
    expect(horaLegible(undefined)).toBeNull();
    expect(horaLegible('')).toBeNull();
  });
});
