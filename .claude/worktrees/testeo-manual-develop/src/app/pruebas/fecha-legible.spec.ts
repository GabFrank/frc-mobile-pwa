import { describe, expect, it } from 'vitest';

import { fechaLegible } from '../generic/utils/dateUtils';

/**
 * El central manda dos formatos según el dato: con hora para lo que ocurre en
 * un momento (la apertura de una caja) y sin hora para lo que ocurre en un
 * día (un vale, una jornada). El parseo es manual porque
 * `new Date('2022-10-12 10:13')` no está especificado: Chrome lo lee como
 * hora local y Safari devuelve `Invalid Date`.
 */
describe('fechaLegible', () => {
  it('convierte fecha con hora', () => {
    expect(fechaLegible('2022-10-12 10:13')).toBe('12/10/2022 10:13');
  });

  it('acepta el separador ISO', () => {
    expect(fechaLegible('2022-10-12T10:13:44')).toBe('12/10/2022 10:13');
  });

  /*
    Exigir la hora hacía que las fechas de vales y jornadas devolvieran null,
    y la pantalla mostrara "Sin fecha" teniendo el dato en la mano.
  */
  it('convierte fecha sin hora, que es lo que mandan vales y jornadas', () => {
    expect(fechaLegible('2026-03-16')).toBe('16/03/2026');
  });

  it('devuelve null cuando no hay nada que mostrar', () => {
    expect(fechaLegible(null)).toBeNull();
    expect(fechaLegible(undefined)).toBeNull();
    expect(fechaLegible('')).toBeNull();
    expect(fechaLegible('no es una fecha')).toBeNull();
  });

  it('acepta un Date', () => {
    expect(fechaLegible(new Date(2026, 2, 16, 9, 5))).toBe('16/03/2026 09:05');
  });

  it('descarta un Date inválido en vez de mostrar "Invalid Date"', () => {
    expect(fechaLegible(new Date('nada'))).toBeNull();
  });
});

describe('fechaLegible — la época y la hora opcional', () => {
  it('la época Unix no es una fecha, es una fecha ausente', () => {
    // Así serializa el central un Date nulo. Sin esto, cualquier persona sin
    // nacimiento cargado aparecía nacida el 1/1/1970 a las cero horas.
    expect(fechaLegible('1970-01-01 00:00')).toBeNull();
    expect(fechaLegible('1970-01-01')).toBeNull();
    expect(fechaLegible(new Date(0))).toBeNull();
  });

  it('el 1/1/1970 a una hora real sí es una fecha', () => {
    expect(fechaLegible('1970-01-01 08:30')).toBe('01/01/1970 08:30');
  });

  it('puede pedirse sin hora, para lo que ocurre en un día', () => {
    expect(fechaLegible('2026-03-15 14:20', { conHora: false })).toBe('15/03/2026');
    expect(fechaLegible('2026-03-15 14:20')).toBe('15/03/2026 14:20');
  });
});
