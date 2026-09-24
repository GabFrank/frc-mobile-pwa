import { describe, expect, it } from 'vitest';
import { interpretarQrRetiro } from './gasto-retiro-qr';

/**
 * El QR real, tal como lo arma `PreGastoService.construirQrRetiro()`:
 *
 *   frc-{sucursalCajaId}-PRE_GASTO_RETIRO-{preGastoId}-{sucursalId}-{qrToken}-{ts}
 *
 * Los valores están elegidos para que ningún par coincida: si la función leyera
 * un campo por otro, el test lo delata en vez de pasar de casualidad.
 */
const QR_REAL = 'frc-9-PRE_GASTO_RETIRO-431-7-A1B2C3D4-1700000000';

describe('interpretarQrRetiro', () => {
  it('lee cada campo de la posición correcta', () => {
    const resultado = interpretarQrRetiro(QR_REAL);

    expect(resultado.ok).toBe(true);
    expect(resultado.datos).toEqual({
      preGastoId: 431,
      // La del gasto, no la de la caja. Leerla de `sucursalId` daba 9 y la
      // solicitud no se encontraba.
      sucursalId: 7,
      sucursalCajaId: 9,
      // El token, no el timestamp. Leerlo de `data` mandaba 1700000000 al
      // central y el retiro se rechazaba por «código inválido o expirado».
      qrToken: 'A1B2C3D4',
    });
  });

  it('rechaza lo que no es un QR del sistema', () => {
    expect(interpretarQrRetiro('https://example.com').motivo).toBe('qr-invalido');
    expect(interpretarQrRetiro('').motivo).toBe('qr-invalido');
  });

  it('rechaza un QR del sistema que no es de retiro', () => {
    const otro = 'frc-1-VT-10-20-RegistroVentaTarjetaComponent-4|12500|7-1700000000';
    const resultado = interpretarQrRetiro(otro);

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('no-es-retiro');
  });

  it('rechaza un retiro sin token', () => {
    const resultado = interpretarQrRetiro('frc-9-PRE_GASTO_RETIRO-431-7--1700000000');

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('datos-incompletos');
  });

  it('rechaza un retiro sin sucursal del gasto', () => {
    const resultado = interpretarQrRetiro('frc-9-PRE_GASTO_RETIRO-431-x-A1B2C3D4-1700000000');

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('datos-incompletos');
  });

  it('rechaza un retiro con el campo de sucursal vacío', () => {
    // `Number('')` es 0 y no NaN: sin tratarlo, esto pasaba la validación y
    // la pantalla salía a buscar la solicitud en la sucursal cero.
    const resultado = interpretarQrRetiro('frc-9-PRE_GASTO_RETIRO-431--A1B2C3D4-1700000000');

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('datos-incompletos');
  });

  it('acepta el retiro aunque no se entienda la sucursal de la caja', () => {
    // `sucursalCajaId` es informativo: no hace falta para encontrar el gasto
    // ni para autorizar el retiro, así que no puede bloquearlo.
    const resultado = interpretarQrRetiro('frc-x-PRE_GASTO_RETIRO-431-7-A1B2C3D4-1700000000');

    expect(resultado.ok).toBe(true);
    expect(resultado.datos?.sucursalCajaId).toBeNull();
  });
});
