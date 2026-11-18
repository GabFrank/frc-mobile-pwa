import { describe, expect, it } from 'vitest';

import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { esMonedaEmpresa, monedaInicial, nombreMonedaEmpresa } from './recepcion-moneda';

const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);

const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 });
const dolar = moneda({ id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });
const real = moneda({ id: 3, denominacion: 'REAL', simbolo: 'R$', decimales: 2 });
const lista = [dolar, guarani, real];

describe('esMonedaEmpresa', () => {
  it('compara por id con la moneda de la empresa', () => {
    expect(esMonedaEmpresa(guarani, guarani)).toBe(true);
    expect(esMonedaEmpresa(dolar, guarani)).toBe(false);
  });

  it('una empresa en dólares: el dólar no pide cotización y el guaraní sí', () => {
    expect(esMonedaEmpresa(dolar, dolar)).toBe(true);
    expect(esMonedaEmpresa(guarani, dolar)).toBe(false);
  });

  it('el id puede llegar como texto', () => {
    expect(esMonedaEmpresa(moneda({ id: '1' as unknown as number }), guarani)).toBe(true);
  });

  it('sin empresa resuelta, el guaraní por nombre como siempre', () => {
    expect(esMonedaEmpresa(guarani, null)).toBe(true);
    expect(esMonedaEmpresa(dolar, null)).toBe(false);
  });
});

describe('monedaInicial', () => {
  it('sin configuración (COMPRAS = empresa) arranca en el guaraní, esté donde esté', () => {
    expect(monedaInicial(lista, guarani, guarani)).toBe(guarani);
  });

  it('con COMPRAS en dólares arranca en dólares', () => {
    expect(monedaInicial(lista, dolar, guarani)).toBe(dolar);
  });

  it('si COMPRAS no está en la lista, la de la empresa', () => {
    expect(monedaInicial([dolar, guarani], real, guarani)).toBe(guarani);
  });

  it('sin nada resuelto, el guaraní por nombre y, si no, la primera', () => {
    expect(monedaInicial(lista, null, null)).toBe(guarani);
    expect(monedaInicial([dolar, real], null, null)).toBe(dolar);
    expect(monedaInicial([], null, null)).toBeUndefined();
  });
});

describe('nombreMonedaEmpresa', () => {
  it('guaraní o sin empresa: «guaraníes», el texto de siempre', () => {
    expect(nombreMonedaEmpresa(guarani)).toBe('guaraníes');
    expect(nombreMonedaEmpresa(null)).toBe('guaraníes');
  });

  it('otra empresa: su moneda', () => {
    expect(nombreMonedaEmpresa(dolar)).toBe('DOLAR');
  });
});
