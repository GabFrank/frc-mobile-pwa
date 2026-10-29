import { describe, expect, it } from 'vitest';

import { construirPrecioInput } from 'src/app/pages/producto/editar/precios.page';
import { Moneda } from './moneda.model';
import {
  agruparPorOrigen,
  esErrorVersionMinima,
  monedaIdParaGuardar,
  monedasPorPrecio,
  referenciaDePrecio,
  textoVersionMinima,
} from './precio-moneda';

const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);
const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 });
const dolar = moneda({ id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });
const base = { id: 5, precio: 10, tipoPrecioId: 1, principal: false, activo: true };

describe('construirPrecioInput', () => {
  it('sin monedaId no lleva la clave: el input es el de siempre', () => {
    const input = construirPrecioInput(base, 8, 3);
    expect('monedaId' in input).toBe(false);
    expect(construirPrecioInput(base, 8, 3, null)).not.toHaveProperty('monedaId');
    expect(construirPrecioInput(base, 8, 3, undefined)).not.toHaveProperty('monedaId');
  });

  it('con monedaId la manda', () => {
    expect(construirPrecioInput(base, 8, 3, 2).monedaId).toBe(2);
  });
});

describe('monedaIdParaGuardar', () => {
  it('central viejo (lectura fallida): nunca manda moneda', () => {
    expect(monedaIdParaGuardar({ soportado: false, empresa: guarani, elegida: dolar, porDefecto: dolar })).toBeUndefined();
    expect(monedaIdParaGuardar({ soportado: false, empresa: guarani, guardada: dolar })).toBeUndefined();
  });

  it('todo en la moneda de la empresa: no manda nada', () => {
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani, elegida: guarani, porDefecto: guarani })).toBeUndefined();
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani })).toBeUndefined();
  });

  it('precio nuevo en otra moneda que la empresa: manda esa', () => {
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani, elegida: dolar, porDefecto: guarani })).toBe(2);
  });

  it('elegir la de la empresa cuando el módulo es otra: hay que mandarla', () => {
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani, elegida: guarani, porDefecto: dolar })).toBe(1);
  });

  it('edición de un precio con moneda guardada: la conserva', () => {
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani, guardada: dolar })).toBe(2);
  });

  it('edición de un precio sin moneda: no manda la clave', () => {
    expect(monedaIdParaGuardar({ soportado: true, empresa: guarani, guardada: undefined })).toBeUndefined();
  });

  it('compara ids como texto', () => {
    const empresa = moneda({ id: '1' as unknown as number });
    expect(monedaIdParaGuardar({ soportado: true, empresa, elegida: guarani, porDefecto: guarani })).toBeUndefined();
  });
});

describe('referenciaDePrecio', () => {
  it('sin moneda propia: guaraní y ₲ como siempre', () => {
    expect(referenciaDePrecio(null, guarani)).toEqual({ moneda: 'Guaraní', simbolo: '₲' });
    expect(referenciaDePrecio(undefined, null)).toEqual({ moneda: 'Guaraní', simbolo: '₲' });
  });

  it('con otra moneda: su símbolo y sus decimales', () => {
    const ref = referenciaDePrecio(dolar, guarani);
    expect(ref.simbolo).toBe('US$');
    expect(ref.moneda).toBe(dolar);
  });

  it('una empresa en dólares sin moneda propia se muestra en dólares', () => {
    expect(referenciaDePrecio(null, dolar).simbolo).toBe('US$');
  });
});

describe('monedasPorPrecio', () => {
  it('guarda solo los precios con moneda propia, por id de texto', () => {
    const mapa = monedasPorPrecio([
      { id: '10', moneda: { id: '2', denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 } },
      { id: 11, moneda: null },
      { id: 12 },
    ]);
    expect([...mapa.keys()]).toEqual(['10']);
    expect(mapa.get('10')?.id).toBe(2);
    expect(mapa.get('10')).toBeInstanceOf(Moneda);
  });

  it('sin filas, vacío', () => {
    expect(monedasPorPrecio(null).size).toBe(0);
  });
});

describe('VERSION_MINIMA', () => {
  it('reconoce el rechazo y le saca el prefijo', () => {
    const msg = 'VERSION_MINIMA: Actualizá el escritorio a 4.2.0';
    expect(esErrorVersionMinima(msg)).toBe(true);
    expect(textoVersionMinima(msg)).toContain('Actualizá el escritorio a 4.2.0');
    expect(textoVersionMinima(msg)).not.toContain('VERSION_MINIMA');
  });

  it('otro error no es de versión mínima', () => {
    expect(esErrorVersionMinima('Sin permiso')).toBe(false);
    expect(esErrorVersionMinima(undefined)).toBe(false);
  });
});

describe('agruparPorOrigen', () => {
  it('todo en la moneda de la empresa: un solo grupo sin origen, en orden', () => {
    const grupos = agruparPorOrigen(
      [{ monto: 100, moneda: null }, { monto: null, moneda: guarani }, { monto: 300, moneda: undefined }],
      guarani,
    );
    expect(grupos).toEqual([{ monedaOrigenId: null, indices: [0, 1, 2], montos: [100, null, 300] }]);
  });

  it('separa los precios en otra moneda, con su posición original', () => {
    const grupos = agruparPorOrigen(
      [{ monto: 100, moneda: null }, { monto: 4.5, moneda: dolar }, { monto: 7, moneda: dolar }],
      guarani,
    );
    expect(grupos).toEqual([
      { monedaOrigenId: null, indices: [0], montos: [100] },
      { monedaOrigenId: 2, indices: [1, 2], montos: [4.5, 7] },
    ]);
  });
});
