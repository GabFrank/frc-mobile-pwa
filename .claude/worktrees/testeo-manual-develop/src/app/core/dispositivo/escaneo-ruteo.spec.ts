import { describe, expect, it } from 'vitest';
import { rutearEscaneo } from './escaneo-ruteo';

/**
 * Arma un QR del sistema campo por campo.
 *
 * Se escribe posicional a propósito, igual que lo emite quien lo genera: usar
 * `codificarQr` acá escondería justamente el error que estos tests buscan
 * —leer un campo por otro—, porque codificador y decodificador comparten el
 * mismo orden y se cancelarían entre sí.
 */
function qr(
  sucursalId: string,
  tipoEntidad: string,
  idOrigen: string,
  idCentral: string,
  componentToOpen = '',
  data = '',
  timestamp = '1700000000',
): string {
  return ['frc', sucursalId, tipoEntidad, idOrigen, idCentral, componentToOpen, data, timestamp].join(
    '-',
  );
}

describe('rutearEscaneo', () => {
  describe('QR que abren un registro', () => {
    it('lleva una transferencia a su detalle, por idOrigen', () => {
      // El generador escribe el mismo id en idOrigen y en idCentral; se
      // desempatan acá para probar de cuál se lee.
      const destino = rutearEscaneo(qr('3', 'TRF', '88', '99'));

      expect(destino).toEqual({ clase: 'navegar', ruta: ['/transferencias', 88] });
    });

    it('lleva un inventario a su detalle, por idCentral', () => {
      // `edit-inventario` NO escribe idOrigen: queda la cadena vacía. Leer de
      // ahí daría NaN y el inventario no abriría nunca.
      const destino = rutearEscaneo(qr('3', 'INV', '', '55'));

      expect(destino).toEqual({ clase: 'navegar', ruta: ['/inventario', 55] });
    });

    it('lleva una recepción a su detalle', () => {
      const destino = rutearEscaneo(qr('3', 'REC_MERC', '12', '12'));

      expect(destino).toEqual({ clase: 'navegar', ruta: ['/operaciones/recepcion', 12] });
    });

    it('avisa cuando el QR es del tipo correcto pero no trae el id', () => {
      const destino = rutearEscaneo(qr('3', 'INV', '', ''));

      expect(destino.clase).toBe('desconocido');
    });
  });

  describe('QR que necesitan validarse en la pantalla', () => {
    it('manda el retiro de caja chica al detalle con su token', () => {
      const destino = rutearEscaneo('frc-9-PRE_GASTO_RETIRO-431-7-A1B2C3D4-1700000000');

      expect(destino).toEqual({
        clase: 'navegar',
        ruta: ['/operaciones/gastos', 431, 7],
        queryParams: { token: 'A1B2C3D4' },
      });
    });

    it('manda el cupón de tarjeta a su lista, entero', () => {
      // No se resuelve acá: solo el cajero de turno puede registrarlo, y eso
      // se valida contra la caja abierta, que este ruteador no conoce.
      const codigo = qr('1', 'VT', '10', '20', 'RegistroVentaTarjetaComponent', '4|12500|7');
      const destino = rutearEscaneo(codigo);

      expect(destino).toEqual({
        clase: 'navegar',
        ruta: ['/operaciones/venta-tarjeta'],
        queryParams: { qr: codigo },
      });
    });

    it('manda la compra a crédito a Mis finanzas, entera', () => {
      const codigo = qr('1', 'VENTA_CREDITO', '42', '', '', 'CLAVE');
      const destino = rutearEscaneo(codigo);

      expect(destino).toEqual({
        clase: 'navegar',
        ruta: ['/mis-finanzas'],
        queryParams: { qr: codigo },
      });
    });
  });

  describe('lo que no abre una pantalla', () => {
    it('explica que el QR de sucursal se escanea desde adentro de un flujo', () => {
      const destino = rutearEscaneo(qr('4', 'SUC', '4', '4'));

      expect(destino.clase).toBe('desconocido');
      expect(destino).toHaveProperty('mensaje', expect.stringContaining('sucursal'));
    });

    it('avisa ante un tipo del sistema que no tiene destino', () => {
      const destino = rutearEscaneo(qr('1', 'BANCO', '1', '1'));

      expect(destino.clase).toBe('desconocido');
    });

    it('no acepta el texto vacío', () => {
      expect(rutearEscaneo('   ').clase).toBe('desconocido');
    });
  });

  describe('códigos que no son QR del sistema', () => {
    it('trata un EAN-13 como producto', () => {
      expect(rutearEscaneo('7840001234567')).toEqual({
        clase: 'producto',
        codigo: '7840001234567',
      });
    });

    it('trata un código de balanza como producto', () => {
      // El peso lo resuelve el buscador, que sabe distinguirlo. Acá solo se
      // decide que no es un QR interno.
      expect(rutearEscaneo('2012345001503')).toEqual({
        clase: 'producto',
        codigo: '2012345001503',
      });
    });

    it('recorta los espacios que agrega un lector', () => {
      expect(rutearEscaneo('  7840001234567 ')).toEqual({
        clase: 'producto',
        codigo: '7840001234567',
      });
    });

    it('no confunde una URL con un QR del sistema', () => {
      expect(rutearEscaneo('https://example.com/a-b-c-d-e-f-g')).toEqual({
        clase: 'producto',
        codigo: 'https://example.com/a-b-c-d-e-f-g',
      });
    });
  });
});
