import { describe, expect, it } from 'vitest';

import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';
import { monedaParaImporte } from './monedas-sesion';

const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);

const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0, principal: true });
const dolar = moneda({ id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });
const real = moneda({ id: 3, denominacion: 'REAL', simbolo: 'R$', decimales: 2 });
const catalogo = [guarani, dolar, real];

describe('monedaParaImporte', () => {
  it('la moneda explícita manda, aunque la empresa sea otra', () => {
    expect(monedaParaImporte('Guaraní', null, dolar, catalogo)).toBe('Guaraní');
    expect(monedaParaImporte(dolar, 'Gs.', guarani, catalogo)).toBe(dolar);
  });

  it('sin moneda ni símbolo, la de la empresa: guaraníes sin «,00»', () => {
    const efectiva = monedaParaImporte(null, null, guarani, catalogo);
    expect(efectiva).toBe(guarani);
    expect(formatearImporte(1500000, efectiva)).toBe('1.500.000');
  });

  it('un texto vacío cuenta como sin moneda', () => {
    expect(monedaParaImporte('  ', null, guarani, catalogo)).toBe(guarani);
  });

  it('sin moneda pero con símbolo, la del catálogo con ese símbolo', () => {
    // Una factura en dólares no puede salir sin centavos porque la empresa
    // trabaje en guaraníes.
    const efectiva = monedaParaImporte(null, 'us$', guarani, catalogo);
    expect(efectiva).toBe(dolar);
    expect(formatearImporte(10.5, efectiva)).toBe('10,50');
    expect(monedaParaImporte(undefined, 'Gs.', null, catalogo)).toBe(guarani);
  });

  it('sin catálogo, el símbolo de la empresa la identifica', () => {
    expect(monedaParaImporte(null, 'Gs.', guarani, [])).toBe(guarani);
  });

  it('un símbolo desconocido se usa como texto, como antes', () => {
    expect(monedaParaImporte(null, '€', guarani, catalogo)).toBe('€');
    expect(formatearImporte(10.5, monedaParaImporte(null, '€', guarani, catalogo))).toBe('10,50');
    expect(formatearImporte(1500, monedaParaImporte(null, '₲', null, []))).toBe('1.500');
  });

  it('un símbolo ambiguo en el catálogo no elige al azar', () => {
    const otroDolar = moneda({ id: 4, denominacion: 'DOLAR BLUE', simbolo: 'US$', decimales: 4 });
    expect(monedaParaImporte(null, 'US$', guarani, [...catalogo, otroDolar])).toBe('US$');
  });

  it('sin empresa todavía, null: dos decimales, el comportamiento anterior', () => {
    const efectiva = monedaParaImporte(null, null, null, []);
    expect(efectiva).toBeNull();
    expect(formatearImporte(1500, efectiva)).toBe('1.500,00');
  });
});
