import { describe, expect, it } from 'vitest';

import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { monedaDeFactura, textoMoneda } from './compras-moneda';

const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);
const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 });
const dolar = moneda({ id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });
const catalogo = [guarani, dolar];
const num = (v: number) => String(v);

describe('monedaDeFactura', () => {
  it('por id, que puede llegar como texto', () => {
    expect(monedaDeFactura({ monedaId: '2' }, catalogo)).toBe(dolar);
  });
  it('sin id, por símbolo si es único', () => {
    expect(monedaDeFactura({ monedaSimbolo: 'us$' }, catalogo)).toBe(dolar);
    expect(monedaDeFactura({ monedaSimbolo: '?' }, catalogo)).toBeNull();
  });
  it('sin factura o sin catálogo, null', () => {
    expect(monedaDeFactura(null, catalogo)).toBeNull();
    expect(monedaDeFactura({ monedaId: 1 }, [])).toBeNull();
  });
});

describe('textoMoneda', () => {
  it('factura en guaraníes con empresa en guaraníes: sin cotización', () => {
    expect(textoMoneda({ moneda: 'GUARANI', cotizacion: 1 }, guarani, guarani, num)).toBe('GUARANI');
  });
  it('factura en dólares con empresa en guaraníes: con cotización', () => {
    expect(textoMoneda({ moneda: 'DOLAR', cotizacion: 7300 }, dolar, guarani, num)).toBe('DOLAR · cotización 7300');
  });
  it('empresa en dólares: la factura en dólares no lleva cotización y la de guaraníes sí', () => {
    expect(textoMoneda({ moneda: 'DOLAR', cotizacion: 1 }, dolar, dolar, num)).toBe('DOLAR');
    expect(textoMoneda({ moneda: 'GUARANI', cotizacion: 0.00014 }, guarani, dolar, num)).toBe('GUARANI · cotización 0.00014');
  });
  it('sin cotización no se muestra', () => {
    expect(textoMoneda({ moneda: 'DOLAR', cotizacion: null }, dolar, guarani, num)).toBe('DOLAR');
  });
  it('sin moneda o empresa resueltas rige la regla de antes: cotización mayor que 1', () => {
    expect(textoMoneda({ moneda: 'DOLAR', cotizacion: 7300 }, null, null, num)).toBe('DOLAR · cotización 7300');
    expect(textoMoneda({ moneda: 'GUARANI', cotizacion: 1 }, null, guarani, num)).toBe('GUARANI');
  });
});
