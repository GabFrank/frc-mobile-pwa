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
    expect(descodificarQr('frc-1-VT-10-20-X')).toBeNull();
  });

  /**
   * Regresión: el central emite el QR de retiro con siete campos, no ocho.
   * Cuando el mínimo era ocho, el escaneo de caja chica se rechazaba entero
   * con «Ese código no es de esta aplicación» y no había forma de retirar.
   *
   * Ver `PreGastoService.construirQrRetiro()` en el central.
   */
  it('acepta la variante de siete campos que emite el central', () => {
    const retiro = descodificarQr('frc-9-PRE_GASTO_RETIRO-431-7-A1B2C3D4-1700000000');

    expect(retiro).not.toBeNull();
    expect(retiro?.tipoEntidad).toBe('PRE_GASTO_RETIRO');
    // El id de la solicitud, no el de la sucursal.
    expect(retiro?.idOrigen).toBe('431');
    // La sucursal del gasto viaja en idCentral; la de la caja, en sucursalId.
    expect(retiro?.idCentral).toBe('7');
    expect(retiro?.sucursalId).toBe('9');
    // Y el token cae en componentToOpen, no en data.
    expect(retiro?.componentToOpen).toBe('A1B2C3D4');
  });

  it('completa los campos ausentes con vacío al codificar', () => {
    const codigo = codificarQr({ sucursalId: '1', tipoEntidad: 'VT' });
    expect(codigo.split('-').length).toBe(8);
  });
});
