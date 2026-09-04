import { describe, expect, it } from 'vitest';

import { aIso, desdeIso, formatearFechaPy, parsearFechaPy } from './fecha-py';

/**
 * Las cuatro conversiones que necesita un campo de fecha.
 *
 * Están separadas del componente porque cada una tiene una forma de fallar
 * silenciosa —un día corrido, una fecha inválida que pasa por válida— y esas
 * se ven en un test de seis líneas, no mirando la pantalla.
 */
describe('Fechas del campo de fecha', () => {
  describe('desdeIso', () => {
    it('arma la fecha en hora local, no en UTC', () => {
      // ⚠️ La regresión que justifica no usar `new Date('2026-03-15')`: eso
      // es medianoche UTC, y al oeste de Greenwich —Paraguay— cae el 14.
      const fecha = desdeIso('2026-03-15');
      expect(fecha?.getFullYear()).toBe(2026);
      expect(fecha?.getMonth()).toBe(2);
      expect(fecha?.getDate()).toBe(15);
    });

    it('acepta lo que manda el central, con hora y con espacio', () => {
      // `yyyy-MM-dd HH:mm` no es ISO 8601: Safari lo lee como Invalid Date.
      expect(desdeIso('2026-03-15 09:30')?.getDate()).toBe(15);
      expect(desdeIso('2026-03-15T09:30:00')?.getDate()).toBe(15);
    });

    it('la época Unix es una fecha ausente, no una fecha', () => {
      expect(desdeIso('1970-01-01')).toBeNull();
    });

    it('sin texto no inventa una fecha', () => {
      expect(desdeIso('')).toBeNull();
      expect(desdeIso(null)).toBeNull();
      expect(desdeIso('cualquier cosa')).toBeNull();
    });
  });

  describe('aIso', () => {
    it('usa el día local, no el UTC', () => {
      // `toISOString()` convierte a UTC: el 15 a las 21:00 en Asunción ya es
      // el 16 en Greenwich, y el vencimiento se guardaba corrido un día.
      const fecha = new Date(2026, 2, 15, 21, 0, 0);
      expect(aIso(fecha)).toBe('2026-03-15');
    });

    it('rellena mes y día a dos dígitos', () => {
      expect(aIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('una fecha inválida no produce texto', () => {
      expect(aIso(new Date(NaN))).toBeNull();
      expect(aIso(null)).toBeNull();
    });
  });

  describe('parsearFechaPy', () => {
    it('lee dd/MM/yyyy, que es como se escribe acá', () => {
      // ⚠️ `Date.parse('15/03/2026')` da Invalid Date: el parser nativo lee
      // MM/dd/yyyy. Por eso el adaptador de Material no alcanza solo.
      const fecha = parsearFechaPy('15/03/2026');
      expect(aIso(fecha)).toBe('2026-03-15');
    });

    it('no exige los ceros ni la barra', () => {
      expect(aIso(parsearFechaPy('5/3/2026'))).toBe('2026-03-05');
      expect(aIso(parsearFechaPy('05-03-2026'))).toBe('2026-03-05');
      expect(aIso(parsearFechaPy('05.03.2026'))).toBe('2026-03-05');
    });

    it('rechaza un día que ese mes no tiene', () => {
      // Sin este chequeo, `new Date(2026, 1, 31)` se corre solo al 3 de marzo
      // y el campo aceptaría el 31/02 mostrando otra fecha.
      expect(parsearFechaPy('31/02/2026')).toBeNull();
      expect(parsearFechaPy('00/03/2026')).toBeNull();
      expect(parsearFechaPy('15/13/2026')).toBeNull();
    });

    it('sin año de cuatro dígitos no adivina el siglo', () => {
      expect(parsearFechaPy('15/03/26')).toBeNull();
    });

    it('lo vacío es vacío, no una fecha', () => {
      expect(parsearFechaPy('')).toBeNull();
      expect(parsearFechaPy('   ')).toBeNull();
    });
  });

  describe('formatearFechaPy', () => {
    it('escribe dd/MM/yyyy con los ceros', () => {
      // Los mismos ceros que pone `fechaLegible`: dos formatos distintos para
      // la misma fecha en la misma pantalla se leen como dos fechas.
      expect(formatearFechaPy(new Date(2026, 0, 5))).toBe('05/01/2026');
    });

    it('una fecha inválida se muestra vacía', () => {
      expect(formatearFechaPy(new Date(NaN))).toBe('');
    });
  });

  it('la ida y la vuelta no corren el día', () => {
    // El ciclo completo del campo: llega del central, se muestra, se elige en
    // el calendario y se guarda.
    const original = '2026-12-31';
    expect(aIso(parsearFechaPy(formatearFechaPy(desdeIso(original)!)))).toBe(original);
  });
});
