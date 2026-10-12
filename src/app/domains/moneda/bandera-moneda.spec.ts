import { describe, expect, it } from 'vitest';
import { banderaDeMoneda } from './bandera-moneda';

describe('banderaDeMoneda', () => {
  it('reconoce las cuatro monedas de frc-mobile por denominación', () => {
    expect(banderaDeMoneda({ denominacion: 'GUARANI' })).toBe('assets/flags/paraguay.png');
    expect(banderaDeMoneda({ denominacion: 'REAL' })).toBe('assets/flags/brazil.png');
    expect(banderaDeMoneda({ denominacion: 'DOLAR' })).toBe('assets/flags/eeuu.png');
    expect(banderaDeMoneda({ denominacion: 'PESO ARGENTINO' })).toBe('assets/flags/argentina.png');
  });

  it('y por símbolo, sin importar mayúsculas ni espacios en la denominación', () => {
    expect(banderaDeMoneda({ simbolo: 'Gs.' })).toBe('assets/flags/paraguay.png');
    expect(banderaDeMoneda({ simbolo: 'R$' })).toBe('assets/flags/brazil.png');
    expect(banderaDeMoneda({ simbolo: 'AR$' })).toBe('assets/flags/argentina.png');
    expect(banderaDeMoneda({ denominacion: ' real ' })).toBe('assets/flags/brazil.png');
  });

  it('una moneda desconocida no tiene bandera: se muestra su símbolo', () => {
    expect(banderaDeMoneda({ denominacion: 'EURO', simbolo: '€' })).toBeNull();
    expect(banderaDeMoneda(null)).toBeNull();
  });
});
