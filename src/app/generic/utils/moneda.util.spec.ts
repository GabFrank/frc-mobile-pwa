import { describe, expect, it } from 'vitest';
import {
  esGuarani,
  formatearImporte,
  parsearImporte,
  precisionDe,
  redondearAMoneda,
  esEntero,
  PRECISION_GUARANI,
  PRECISION_DECIMAL,
} from './moneda.util';

/**
 * El guaraní sin decimales es la regla de negocio que este módulo existe
 * para encapsular. Los tests la fijan.
 */
describe('moneda.util', () => {
  describe('esGuarani', () => {
    it('reconoce las formas en que el backend nombra al guaraní', () => {
      expect(esGuarani('Guaraní')).toBe(true);
      expect(esGuarani('GUARANI')).toBe(true);
      expect(esGuarani('guarani')).toBe(true);
      expect(esGuarani('₲')).toBe(true);
      expect(esGuarani('Gs.')).toBe(true);
      expect(esGuarani('PYG')).toBe(true);
    });

    it('no confunde otras monedas', () => {
      expect(esGuarani('Dólar')).toBe(false);
      expect(esGuarani('Real')).toBe(false);
      expect(esGuarani('')).toBe(false);
      expect(esGuarani(null)).toBe(false);
      expect(esGuarani(undefined)).toBe(false);
    });
  });

  describe('precisionDe', () => {
    it('da cero decimales al guaraní y dos al resto', () => {
      expect(precisionDe('Guaraní')).toBe(PRECISION_GUARANI);
      expect(precisionDe('Dólar')).toBe(PRECISION_DECIMAL);
      // Sin moneda se asume decimal: es el caso conservador.
      expect(precisionDe(null)).toBe(PRECISION_DECIMAL);
    });
  });

  describe('formatearImporte', () => {
    it('formatea guaraníes sin decimales', () => {
      expect(formatearImporte(1500000, 'Guaraní')).toBe('1.500.000');
      expect(formatearImporte(1234.56, 'Guaraní')).toBe('1.235');
    });

    it('formatea otras monedas con dos decimales', () => {
      expect(formatearImporte(1284.5, 'Dólar')).toBe('1.284,50');
      expect(formatearImporte(89.9, 'Real')).toBe('89,90');
    });

    it('antepone el símbolo cuando se pasa', () => {
      expect(formatearImporte(12500, 'Guaraní', '₲')).toBe('₲ 12.500');
    });

    it('devuelve vacío ante valores no numéricos', () => {
      expect(formatearImporte(null)).toBe('');
      expect(formatearImporte(undefined)).toBe('');
      expect(formatearImporte(Number.NaN)).toBe('');
      expect(formatearImporte(Number.POSITIVE_INFINITY)).toBe('');
    });

    it('formatea el cero, que no es lo mismo que ausencia de valor', () => {
      expect(formatearImporte(0, 'Guaraní')).toBe('0');
    });

    it('no muestra "-0": un arqueo balanceado no es un faltante', () => {
      expect(formatearImporte(-0, 'Guaraní')).toBe('0');
    });

    it('conserva el signo de los negativos', () => {
      // Un faltante de arqueo tiene que verse como negativo.
      expect(formatearImporte(-43500, 'Guaraní')).toBe('-43.500');
    });
  });

  describe('parsearImporte', () => {
    it('interpreta el formato es-PY: punto para miles, coma para decimales', () => {
      expect(parsearImporte('1.500.000')).toBe(1500000);
      expect(parsearImporte('1.284,50')).toBe(1284.5);
      expect(parsearImporte('89,90')).toBe(89.9);
    });

    it('tolera símbolos y espacios', () => {
      expect(parsearImporte('₲ 12.500')).toBe(12500);
      expect(parsearImporte('  450000  ')).toBe(450000);
    });

    it('devuelve null cuando no hay número', () => {
      expect(parsearImporte('')).toBeNull();
      expect(parsearImporte('   ')).toBeNull();
      expect(parsearImporte('abc')).toBeNull();
      expect(parsearImporte(null)).toBeNull();
      expect(parsearImporte(undefined)).toBeNull();
      expect(parsearImporte('-')).toBeNull();
    });

    it('parsea negativos', () => {
      expect(parsearImporte('-43.500')).toBe(-43500);
    });

    it('interpreta el punto como decimal cuando no hay coma', () => {
      // Los teclados numéricos de Android e iOS insertan '.' según el idioma
      // del sistema. Sin esta regla, "10.50" se leía como 1050: error de 100x.
      expect(parsearImporte('10.50')).toBe(10.5);
      expect(parsearImporte('1234.56')).toBe(1234.56);
      expect(parsearImporte('0.99')).toBe(0.99);
      expect(parsearImporte('-10.50')).toBe(-10.5);
    });

    it('con coma presente, el punto sigue siendo separador de miles', () => {
      expect(parsearImporte('1.234,56')).toBe(1234.56);
      expect(parsearImporte('1.500.000,00')).toBe(1500000);
    });

    it('tres o más dígitos después del punto siguen siendo miles', () => {
      expect(parsearImporte('1.500')).toBe(1500);
      expect(parsearImporte('1.500.000')).toBe(1500000);
    });

    it('es inverso de formatear', () => {
      const valores = [0, 1, 999, 1500000, -43500];
      for (const v of valores) {
        expect(parsearImporte(formatearImporte(v, 'Guaraní'))).toBe(v);
      }
    });
  });

  describe('redondearAMoneda', () => {
    it('redondea guaraníes a entero', () => {
      expect(redondearAMoneda(1234.56, 'Guaraní')).toBe(1235);
      expect(redondearAMoneda(1234.4, 'Guaraní')).toBe(1234);
    });

    it('redondea el resto a dos decimales', () => {
      expect(redondearAMoneda(1234.567, 'Dólar')).toBe(1234.57);
    });

    it('no altera un valor ya redondeado', () => {
      expect(redondearAMoneda(1500000, 'Guaraní')).toBe(1500000);
    });

    it('redondea simétricamente los negativos', () => {
      // Math.round lleva los .5 hacia +infinito: un sobrante y un faltante de
      // la misma magnitud redondeaban distinto.
      expect(redondearAMoneda(1234.5, 'Guaraní')).toBe(1235);
      expect(redondearAMoneda(-1234.5, 'Guaraní')).toBe(-1235);
    });
  });

  describe('esEntero', () => {
    it('distingue enteros de decimales', () => {
      expect(esEntero(5)).toBe(true);
      expect(esEntero(5.5)).toBe(false);
      expect(esEntero(Number.NaN)).toBe(false);
    });
  });
});
