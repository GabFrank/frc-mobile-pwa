import { describe, expect, it } from 'vitest';
import { comparatorLike, generateUUID } from './string-utils';

describe('string-utils', () => {
  describe('comparatorLike', () => {
    it('hace búsqueda difusa entre caracteres', () => {
      expect(comparatorLike('cocacola', 'Coca Cola 2L')).toBe(true);
      expect(comparatorLike('ccl', 'Coca Cola 2L')).toBe(true);
    });

    it('ignora espacios del patrón', () => {
      expect(comparatorLike('coca cola', 'CocaCola')).toBe(true);
    });

    it('no matchea si falta una letra', () => {
      expect(comparatorLike('pepsi', 'Coca Cola')).toBe(false);
    });

    it('un patrón vacío matchea todo', () => {
      expect(comparatorLike('', 'lo que sea')).toBe(true);
    });

    it('escapa los metacaracteres de regex sin lanzar', () => {
      // En frc-mobile esto lanzaba excepción (TODO_TECNICO #12).
      expect(() => comparatorLike('(', 'texto (con paréntesis)')).not.toThrow();
      expect(() => comparatorLike('[', 'texto [corchete]')).not.toThrow();
      expect(() => comparatorLike('*', 'texto * asterisco')).not.toThrow();
      expect(() => comparatorLike('a+b', 'a+b')).not.toThrow();
    });

    it('el metacaracter escapado matchea literalmente', () => {
      expect(comparatorLike('(2L)', 'Coca (2L)')).toBe(true);
      expect(comparatorLike('(2L)', 'Coca 2L')).toBe(false);
    });

    it('tolera texto nulo', () => {
      expect(comparatorLike('abc', null as unknown as string)).toBe(false);
    });
  });

  describe('generateUUID', () => {
    it('genera un UUID v4 con formato válido', () => {
      expect(generateUUID()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('no repite', () => {
      const generados = new Set(Array.from({ length: 200 }, () => generateUUID()));
      expect(generados.size).toBe(200);
    });
  });
});
