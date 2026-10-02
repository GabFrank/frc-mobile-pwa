import { describe, expect, it } from 'vitest';

import {
  DESTINO_POR_DEFECTO,
  destinoDeNotificacion,
} from '../core/notificaciones/destino-notificacion';

/**
 * Los destinos de la izquierda son **literales**, sacados uno por uno de
 * `NotificationTemplateService` del central. Si alguno cambia allá, este
 * archivo es el que tiene que enterarse.
 */
describe('Destino de una notificación', () => {
  describe('lo que coincide tal cual', () => {
    it('lleva al inventario', () => {
      expect(destinoDeNotificacion('/inventario/6579')).toBe('/inventario/6579');
    });

    it('sin id, a la lista', () => {
      // El central arma `/inventario/` + id, y el id puede venir vacío.
      expect(destinoDeNotificacion('/inventario/')).toBe('/inventario');
    });
  });

  describe('lo que cambió de ruta', () => {
    it('traduce transferencias', () => {
      expect(destinoDeNotificacion('/operaciones/transferencias/431')).toBe('/transferencias/431');
    });

    it('traduce productos, que acá es singular', () => {
      expect(destinoDeNotificacion('/productos/1234')).toBe('/producto/1234');
    });

    it('un producto sin id lleva al buscador, no a una ficha vacía', () => {
      expect(destinoDeNotificacion('/productos/')).toBe('/buscar');
    });
  });

  describe('lo que el central llama de otra manera', () => {
    it('financiero/gastos es caja chica', () => {
      expect(destinoDeNotificacion('/financiero/gastos/9')).toBe('/operaciones/gastos');
    });

    it('financiero/retiros también', () => {
      expect(destinoDeNotificacion('/financiero/retiros/3')).toBe('/operaciones/gastos');
    });

    it('el análisis de diferencia lleva a la caja, que es donde está el arqueo', () => {
      expect(destinoDeNotificacion('/financiero/analisis-diferencia/12/4')).toBe(
        '/operaciones/caja',
      );
    });

    it('las compras a crédito son Mis finanzas', () => {
      expect(destinoDeNotificacion('/mis-compras/credito/88/2')).toBe('/mis-finanzas');
    });

    it('la seguridad de la cuenta es Mi cuenta', () => {
      expect(destinoDeNotificacion('/configuracion/seguridad')).toBe('/cuenta');
    });
  });

  describe('lo que no tiene equivalente', () => {
    /**
     * Estas pantallas son del escritorio y la PWA no las tiene. Lo importante
     * no es a dónde van sino que **no** vayan a Inicio: el toque salió de una
     * notificación, y su lista es lo único que dice algo sobre ella.
     */
    it.each([
      '/operaciones/movimientos-stock',
      '/operaciones/ventas/45/2',
      '/operaciones/facturas/77/2',
    ])('%s cae en la lista de notificaciones', (ruta) => {
      expect(destinoDeNotificacion(ruta)).toBe(DESTINO_POR_DEFECTO);
    });

    it('«list-cotizacion» no es siquiera una ruta absoluta', () => {
      // Sale así del central, sin barra inicial. No es un destino de nadie.
      expect(destinoDeNotificacion('list-cotizacion')).toBe(DESTINO_POR_DEFECTO);
    });

    it.each([null, undefined, '', '   '])('%s no inventa un destino', (valor) => {
      expect(destinoDeNotificacion(valor)).toBe(DESTINO_POR_DEFECTO);
    });
  });

  describe('la raíz', () => {
    it('es Inicio, y eso sí corresponde', () => {
      expect(destinoDeNotificacion('/')).toBe('/inicio');
    });
  });

  describe('rutas que ya son de esta app', () => {
    /**
     * El central puede mandar un destino escrito a mano por
     * `NotificationTemplateService.manual(...)`. Si ya es una ruta de la PWA,
     * pasa derecho.
     */
    it.each(['/mi-trabajo/aprobaciones', '/operaciones/recepcion', '/marcacion'])(
      '%s pasa sin tocarse',
      (ruta) => {
        expect(destinoDeNotificacion(ruta)).toBe(ruta);
      },
    );

    it('una sección inventada no pasa por parecerse', () => {
      expect(destinoDeNotificacion('/inventarios-viejos')).toBe(DESTINO_POR_DEFECTO);
    });
  });

  describe('formas en que llega el valor', () => {
    it('acepta una URL entera, que es lo que entrega el service worker', () => {
      expect(destinoDeNotificacion('https://app.frc/productos/50')).toBe('/producto/50');
    });

    it('ignora query y fragmento', () => {
      expect(destinoDeNotificacion('/inventario/12?ref=push#top')).toBe('/inventario/12');
    });

    it('la barra final no cambia el destino', () => {
      expect(destinoDeNotificacion('/configuracion/seguridad/')).toBe('/cuenta');
    });

    it('una URL rota no revienta', () => {
      expect(destinoDeNotificacion('http://')).toBe(DESTINO_POR_DEFECTO);
    });
  });
});
