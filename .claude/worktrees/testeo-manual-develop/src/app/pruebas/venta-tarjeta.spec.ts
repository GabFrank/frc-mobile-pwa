import { describe, expect, it } from 'vitest';

import { interpretarQrVenta } from '../pages/operaciones/venta-tarjeta/venta-tarjeta-qr';

/**
 * El QR es la puerta de entrada del módulo y su única validación de
 * seguridad. Cada motivo de rechazo tiene su caso: si uno se afloja, un cupón
 * puede terminar imputado a la caja equivocada.
 */
describe('QR de venta con tarjeta', () => {
  // frc-{suc}-{tipo}-{idOrigen}-{idCentral}-{componente}-{data}-{ts}
  const qr = (partes: Partial<Record<string, string>> = {}) =>
    [
      'frc',
      partes['suc'] ?? '3',
      partes['tipo'] ?? 'VT',
      partes['venta'] ?? '900',
      '0',
      partes['componente'] ?? 'RegistroVentaTarjetaComponent',
      partes['data'] ?? '12|150000',
      '1770000000000',
    ].join('-');

  it('acepta el QR emitido por la caja actual', () => {
    const r = interpretarQrVenta(qr(), 12);

    expect(r.ok).toBe(true);
    expect(r.datos).toEqual({
      ventaId: 900,
      cajaId: 12,
      monto: 150_000,
      sucursalId: 3,
      ventaTarjetaId: null,
    });
  });

  it('lee el id del registro que ya creó el desktop', () => {
    const r = interpretarQrVenta(qr({ data: '12|150000|77' }), 12);

    expect(r.datos?.ventaTarjetaId).toBe(77);
  });

  it('rechaza el cupón de otra caja', () => {
    // Es la protección central: imputar un cupón a la caja equivocada
    // descuadra dos arqueos a la vez.
    const r = interpretarQrVenta(qr({ data: '99|150000' }), 12);

    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('caja-distinta');
    expect(r.mensaje).toContain('otra caja');
  });

  it('sin caja abierta no hay nada contra qué validar', () => {
    expect(interpretarQrVenta(qr(), null).motivo).toBe('sin-caja');
    expect(interpretarQrVenta(qr(), undefined).motivo).toBe('sin-caja');
  });

  it('rechaza un QR de otra entidad', () => {
    expect(interpretarQrVenta(qr({ tipo: 'VENTA_CREDITO' }), 12).motivo).toBe(
      'no-es-venta-tarjeta',
    );
  });

  it('rechaza un QR de venta con tarjeta con otro destino', () => {
    expect(interpretarQrVenta(qr({ componente: 'OtroComponente' }), 12).motivo).toBe(
      'qr-no-reconocido',
    );
  });

  it('rechaza cualquier cosa que no sea un QR de esta app', () => {
    expect(interpretarQrVenta('7840001234567', 12).motivo).toBe('qr-invalido');
    expect(interpretarQrVenta('', 12).motivo).toBe('qr-invalido');
  });

  it('compara la caja por valor: los ids llegan como string', () => {
    expect(interpretarQrVenta(qr({ data: '12|150000' }), '12').ok).toBe(true);
  });

  it('la sucursal sale del QR, no de la caja', () => {
    // La emitió la filial: el central puede tener otro id para esa sucursal,
    // y el guardado tiene que enrutarse con el de la filial.
    expect(interpretarQrVenta(qr({ suc: '7' }), 12).datos?.sucursalId).toBe(7);
  });
});
