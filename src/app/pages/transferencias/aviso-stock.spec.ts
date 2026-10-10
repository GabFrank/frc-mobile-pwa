import { describe, expect, it } from 'vitest';

import { decidirAvisoStock, mensajeAvisoStock } from './aviso-stock';

describe('decidirAvisoStock', () => {
  it('con stock positivo sigue sin avisar', () => {
    expect(decidirAvisoStock(0.5, false)).toBe('SEGUIR');
  });

  it('con stock 0 pide confirmación, permita o no el negativo', () => {
    expect(decidirAvisoStock(0, false)).toBe('CONFIRMAR');
    expect(decidirAvisoStock(0, true)).toBe('CONFIRMAR');
  });

  it('con stock negativo bloquea si la configuración no lo permite', () => {
    expect(decidirAvisoStock(-3, false)).toBe('BLOQUEAR');
  });

  it('con stock negativo pide confirmación si la configuración lo permite', () => {
    expect(decidirAvisoStock(-3, true)).toBe('CONFIRMAR');
  });
});

describe('mensajeAvisoStock', () => {
  it('distingue el 0 del negativo y dice el número', () => {
    expect(mensajeAvisoStock(0)).toContain('stock 0');
    expect(mensajeAvisoStock(-3)).toContain('-3');
  });
});
