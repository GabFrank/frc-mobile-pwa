import { describe, expect, it } from 'vitest';

import {
  esGastoContinuoRecurrente,
  esModuloPadreConCuotasActivo,
  esModuloServicioContinuo,
  etiquetaModuloPadre,
  mostrarCuotasActivo,
  requiereEnteActivo,
  tipoEnteDesdeModuloPadre,
} from '../domains/gastos/tipo-gasto.reglas';

/**
 * Estas reglas deciden qué le pide el formulario al usuario. Son lógica pura
 * y cada rama tiene consecuencias: imputar un gasto al activo equivocado, o
 * no pedirlo cuando hace falta, deja el gasto sin dueño.
 */
describe('Reglas de tipo de gasto', () => {
  describe('servicios continuos', () => {
    it('reconoce los siete', () => {
      for (const m of [
        'ANDE',
        'JUNTA_SANEAMIENTO',
        'IMPUESTO',
        'INTERNET',
        'SEGURIDAD',
        'BASURA',
        'SEGURO',
      ]) {
        expect(esModuloServicioContinuo(m)).toBe(true);
      }
    });

    it('todos se imputan a un INMUEBLE, no a su propio módulo', () => {
      // La luz, el agua o el internet los consume un local, no una categoría.
      expect(tipoEnteDesdeModuloPadre('ANDE')).toBe('INMUEBLE');
      expect(tipoEnteDesdeModuloPadre('INTERNET')).toBe('INMUEBLE');
      expect(tipoEnteDesdeModuloPadre('SEGURO')).toBe('INMUEBLE');
    });

    it('un módulo normal no es servicio continuo', () => {
      expect(esModuloServicioContinuo('VEHICULO')).toBe(false);
      expect(esModuloServicioContinuo(null)).toBe(false);
    });
  });

  describe('tipo de ente', () => {
    it('los módulos directos mapean a sí mismos', () => {
      expect(tipoEnteDesdeModuloPadre('VEHICULO')).toBe('VEHICULO');
      expect(tipoEnteDesdeModuloPadre('MUEBLE')).toBe('MUEBLE');
      expect(tipoEnteDesdeModuloPadre('INMUEBLE')).toBe('INMUEBLE');
    });

    it('EQUIPOS en plural mapea a EQUIPO en singular', () => {
      // El módulo padre y el tipo de ente no usan el mismo string:
      // compararlos directo falla.
      expect(tipoEnteDesdeModuloPadre('EQUIPOS')).toBe('EQUIPO');
    });

    it('PERSONAS y OTRO no requieren activo', () => {
      expect(tipoEnteDesdeModuloPadre('PERSONAS')).toBeNull();
      expect(tipoEnteDesdeModuloPadre('OTRO')).toBeNull();
      expect(requiereEnteActivo('PERSONAS')).toBe(false);
      expect(requiereEnteActivo('OTRO')).toBe(false);
    });

    it('un módulo desconocido tampoco', () => {
      expect(tipoEnteDesdeModuloPadre('LO_QUE_SEA')).toBeNull();
      expect(requiereEnteActivo(null)).toBe(false);
    });

    it('todo lo que resuelve un ente lo exige', () => {
      expect(requiereEnteActivo('VEHICULO')).toBe(true);
      expect(requiereEnteActivo('ANDE')).toBe(true);
    });
  });

  describe('cuotas del activo', () => {
    it('solo cuatro módulos las admiten', () => {
      for (const m of ['INMUEBLE', 'MUEBLE', 'VEHICULO', 'EQUIPOS']) {
        expect(esModuloPadreConCuotasActivo(m)).toBe(true);
      }
      expect(esModuloPadreConCuotasActivo('ANDE')).toBe(false);
      expect(esModuloPadreConCuotasActivo('PERSONAS')).toBe(false);
    });

    it('un módulo sin cuotas no las muestra, diga lo que diga el resto', () => {
      expect(mostrarCuotasActivo('ANDE', 'CONTINUO', true)).toBe(false);
    });

    it('un booleano explícito manda sobre la naturaleza', () => {
      // Es una decisión que alguien ya tomó para esa solicitud.
      expect(mostrarCuotasActivo('VEHICULO', 'CONTINUO', false)).toBe(false);
      expect(mostrarCuotasActivo('VEHICULO', 'VARIABLE', true)).toBe(true);
    });

    it('sin booleano, decide la naturaleza', () => {
      expect(mostrarCuotasActivo('VEHICULO', 'CONTINUO')).toBe(true);
      expect(mostrarCuotasActivo('VEHICULO', 'RECURRENTE')).toBe(true);
      expect(mostrarCuotasActivo('VEHICULO', 'VARIABLE')).toBe(false);
    });

    it('null no cuenta como booleano explícito', () => {
      expect(mostrarCuotasActivo('VEHICULO', 'CONTINUO', null)).toBe(true);
    });
  });

  it('la naturaleza continua o recurrente se reconoce', () => {
    expect(esGastoContinuoRecurrente('CONTINUO')).toBe(true);
    expect(esGastoContinuoRecurrente('RECURRENTE')).toBe(true);
    expect(esGastoContinuoRecurrente('VARIABLE')).toBe(false);
    expect(esGastoContinuoRecurrente(null)).toBe(false);
  });

  describe('etiquetas', () => {
    it('los servicios continuos dicen a qué inmueble se refieren', () => {
      // «Inmueble» a secas no distingue el de la luz del del agua.
      expect(etiquetaModuloPadre('ANDE')).toBe('Inmueble (ANDE)');
      expect(etiquetaModuloPadre('JUNTA_SANEAMIENTO')).toBe('Inmueble (agua)');
    });

    it('los directos usan su nombre', () => {
      expect(etiquetaModuloPadre('VEHICULO')).toBe('Vehículo');
      expect(etiquetaModuloPadre('EQUIPOS')).toBe('Equipo');
    });

    it('lo desconocido cae en «Activo», no en vacío', () => {
      expect(etiquetaModuloPadre('LO_QUE_SEA')).toBe('Activo');
      expect(etiquetaModuloPadre(null)).toBe('Activo');
    });
  });
});
