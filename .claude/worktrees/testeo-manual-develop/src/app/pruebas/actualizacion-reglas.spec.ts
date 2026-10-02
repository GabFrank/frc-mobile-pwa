import { describe, expect, it } from 'vitest';

import {
  debeOfrecer,
  ESPERA_MS,
  etiquetaDeVersion,
  leerPostergacion,
} from '../core/actualizacion/actualizacion-reglas';

const AHORA = 1_800_000_000_000;

describe('Cuándo ofrecer la actualización', () => {
  it('sin versión disponible no se ofrece nada', () => {
    expect(debeOfrecer(null, null, AHORA)).toBe(false);
    expect(debeOfrecer(undefined, null, AHORA)).toBe(false);
  });

  it('la primera vez se ofrece', () => {
    expect(debeOfrecer('abc123', null, AHORA)).toBe(true);
  });

  it('recién postergada no se vuelve a preguntar', () => {
    // Es el caso que motiva todo: el operador está en medio de una recepción.
    expect(debeOfrecer('abc123', { hash: 'abc123', cuando: AHORA - 60_000 }, AHORA)).toBe(false);
  });

  it('pasada la espera se vuelve a preguntar', () => {
    expect(debeOfrecer('abc123', { hash: 'abc123', cuando: AHORA - ESPERA_MS }, AHORA)).toBe(true);
  });

  it('una versión distinta ignora la postergación', () => {
    // Postergar la de ayer no cubre la de hoy, que puede traer justo el
    // arreglo que el usuario necesita.
    expect(debeOfrecer('nueva999', { hash: 'abc123', cuando: AHORA }, AHORA)).toBe(true);
  });

  it('el corte es el tiempo, no la apertura de la app', () => {
    // Una PWA instalada se «abre» muchas veces por día. Si el arranque
    // alcanzara para volver a preguntar, sería la interrupción que se quiso
    // evitar.
    const reciEn = { hash: 'abc123', cuando: AHORA - 1 };
    expect(debeOfrecer('abc123', reciEn, AHORA)).toBe(false);
  });
});

describe('Leer la postergación guardada', () => {
  it('sin nada guardado es null', () => {
    expect(leerPostergacion(null)).toBeNull();
    expect(leerPostergacion('')).toBeNull();
  });

  it('lee lo que guardó', () => {
    expect(leerPostergacion('{"hash":"a","cuando":5}')).toEqual({ hash: 'a', cuando: 5 });
  });

  it('ante basura devuelve null, y en la duda se ofrece', () => {
    // Perder una postergación molesta; perder una actualización deja al
    // operador en una versión vieja sin saberlo.
    expect(leerPostergacion('no es json')).toBeNull();
    expect(leerPostergacion('{"hash":"a"}')).toBeNull();
    expect(leerPostergacion('{"cuando":5}')).toBeNull();
    expect(leerPostergacion('null')).toBeNull();
  });

  it('una postergación ilegible termina ofreciendo', () => {
    expect(debeOfrecer('abc', leerPostergacion('roto'), AHORA)).toBe(true);
  });
});

describe('Cómo se nombra la versión nueva', () => {
  it('usa la etiqueta que selló la build', () => {
    expect(etiquetaDeVersion({ etiqueta: '2026-08-07 11:00' }, 'abc1234567')).toBe(
      '2026-08-07 11:00',
    );
  });

  it('sin appData cae al hash corto, no a un texto genérico', () => {
    // Decir «Actualizar» a secas esconde que hay dos versiones en juego.
    expect(etiquetaDeVersion(null, 'abc1234567')).toBe('abc1234');
    expect(etiquetaDeVersion({}, 'abc1234567')).toBe('abc1234');
    expect(etiquetaDeVersion({ etiqueta: '   ' }, 'abc1234567')).toBe('abc1234');
  });
});
