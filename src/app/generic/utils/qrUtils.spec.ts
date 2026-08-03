import { describe, expect, it } from 'vitest';
import { codificarQr, descodificarQr, QR_PREFIJO } from './qrUtils';

describe('qrUtils', () => {
  const ejemplo = {
    sucursalId: '1',
    tipoEntidad: 'VT',
    idOrigen: '10',
    idCentral: '20',
    componentToOpen: 'RegistroVentaTarjetaComponent',
    data: '4|12500|7',
    timestamp: '1700000000',
  };

  it('codifica con el prefijo del sistema', () => {
    expect(codificarQr(ejemplo).startsWith(`${QR_PREFIJO}-`)).toBe(true);
  });

  it('decodificar es inverso de codificar', () => {
    expect(descodificarQr(codificarQr(ejemplo))).toEqual(ejemplo);
  });

  it('rechaza texto que no es de este sistema', () => {
    // En frc-mobile devolvía un objeto con undefined en vez de null.
    expect(descodificarQr('https://example.com')).toBeNull();
    expect(descodificarQr('otro-1-VT-10-20-X-Y-Z')).toBeNull();
    expect(descodificarQr('')).toBeNull();
    expect(descodificarQr(null)).toBeNull();
    expect(descodificarQr(undefined)).toBeNull();
  });

  it('rechaza un QR con menos partes de las esperadas', () => {
    expect(descodificarQr('frc-1-VT-10')).toBeNull();
  });

  it('completa los campos ausentes con vacío al codificar', () => {
    const codigo = codificarQr({ sucursalId: '1', tipoEntidad: 'VT' });
    expect(codigo.split('-').length).toBe(8);
  });
});
