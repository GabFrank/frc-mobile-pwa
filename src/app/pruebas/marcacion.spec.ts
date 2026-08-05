import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { GeoService } from '../core/dispositivo/geo.service';
import { MarcacionService } from '../pages/marcacion/marcacion.service';
import { EstadoMarcacionUsuarioGQL } from '../graphql/administrativo/marcacion/estadoMarcacionUsuario';
import { SaveMarcacionGQL } from '../graphql/administrativo/marcacion/saveMarcacion';

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
