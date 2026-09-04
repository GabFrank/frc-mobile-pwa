import { describe, expect, it } from 'vitest';
import {
  codigosParaBuscar,
  esCodigoPesable,
  normalizarCodigo,
  parseCodigoPesable,
  pareceBusquedaPorCodigo,
} from './barcodeUtils';

/**
 * Reglas de negocio del escaneo. Ver docs/infraestructura/generic-utils.md.
 */
describe('barcodeUtils', () => {
  describe('normalizarCodigo', () => {
    it('recorta y pasa a mayúsculas', () => {
      expect(normalizarCodigo('  abc-123 ')).toBe('ABC-123');
    });

    it('tolera nulos', () => {
      expect(normalizarCodigo(null as unknown as string)).toBe('');
      expect(normalizarCodigo(undefined as unknown as string)).toBe('');
    });
  });

  describe('esCodigoPesable', () => {
    it('reconoce el formato de balanza: 13 dígitos con prefijo 20', () => {
      expect(esCodigoPesable('2001234012505')).toBe(true);
    });

    it('rechaza un alfanumérico de 13 caracteres que empiece con 20', () => {
      // Antes pasaba el filtro y parseCodigoPesable devolvía NaN como peso.
      expect(esCodigoPesable('20ABC123DE456')).toBe(false);
    });

    it('rechaza lo que no cumple largo o prefijo', () => {
      expect(esCodigoPesable('2001234')).toBe(false);        // corto
      expect(esCodigoPesable('7790895000123')).toBe(false);  // EAN normal
      expect(esCodigoPesable('21012340125051')).toBe(false); // largo
      expect(esCodigoPesable('')).toBe(false);
    });
  });

  describe('parseCodigoPesable', () => {
    it('extrae código interno y convierte gramos a kilos', () => {
      // 20 | 01234 | 01250 | 5  → interno 01234, 1250 g = 1,25 kg
      const r = parseCodigoPesable('2001234012505');
      expect(r.codigoInterno).toBe('01234');
      expect(r.peso).toBe(1.25);
    });

    it('el peso viene en gramos: no devolver el valor crudo', () => {
      const r = parseCodigoPesable('2000042000010');
      // 00001 g = 0,001 kg — el error clásico sería devolver 1
      expect(r.peso).toBe(0.001);
    });
  });

  describe('codigosParaBuscar', () => {
    it('devuelve el pesable completo como primer candidato', () => {
      const c = codigosParaBuscar('2001234012505');
      expect(c[0]).toBe('2001234012505');
    });

    it('acepta un EAN-13 normal', () => {
      expect(codigosParaBuscar('7790895000123')).toContain('7790895000123');
    });

    it('extrae el GTIN de un GS1', () => {
      expect(codigosParaBuscar('(01)07790895000123')).toContain('07790895000123');
    });

    it('del GTIN-14 con cero inicial también ofrece la versión de 13', () => {
      const c = codigosParaBuscar('(01)07790895000123');
      expect(c).toContain('7790895000123');
    });

    it('acepta códigos alfanuméricos internos', () => {
      expect(codigosParaBuscar('ABC-123')).toContain('ABC-123');
    });

    it('no repite candidatos', () => {
      const c = codigosParaBuscar('7790895000123');
      expect(new Set(c).size).toBe(c.length);
    });

    it('devuelve lista vacía ante entrada vacía', () => {
      expect(codigosParaBuscar('')).toEqual([]);
      expect(codigosParaBuscar('   ')).toEqual([]);
    });
  });

  describe('pareceBusquedaPorCodigo', () => {
    it('distingue un código de una descripción', () => {
      expect(pareceBusquedaPorCodigo('7790895000123')).toBe(true);
      expect(pareceBusquedaPorCodigo('ABC-123')).toBe(true);
      expect(pareceBusquedaPorCodigo('2001234012505')).toBe(true);
      expect(pareceBusquedaPorCodigo('(01)07790895000123')).toBe(true);
    });

    it('una descripción con varias palabras no es un código', () => {
      // En frc-mobile esto devolvía true, porque bastaba con que alguna
      // palabra tuviera 4+ caracteres.
      expect(pareceBusquedaPorCodigo('coca cola dos litros')).toBe(false);
      expect(pareceBusquedaPorCodigo('yerba selecta 1kg')).toBe(false);
    });

    it('el texto vacío no es un código', () => {
      expect(pareceBusquedaPorCodigo('')).toBe(false);
      expect(pareceBusquedaPorCodigo('   ')).toBe(false);
    });
  });
});
