import { describe, expect, it } from 'vitest';
import { imagenDePresentacion } from './presentacion.util';

/**
 * El central no manda `null` cuando una presentación no tiene foto: manda un
 * PNG genérico. Mostrarlo en el kiosco como si fuera el producto es lo que
 * esta regla evita.
 */
describe('imagenDePresentacion', () => {
  it('devuelve la foto real, que el central rotula como jpg', () => {
    const foto = 'data:image/jpg;base64,/9j/4AAQSkZJRg';
    expect(imagenDePresentacion(foto)).toBe(foto);
  });

  it('descarta el PNG genérico de «sin imagen»', () => {
    expect(imagenDePresentacion('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg')).toBeNull();
  });

  it('descarta lo vacío y lo que no es un data URI', () => {
    expect(imagenDePresentacion(null)).toBeNull();
    expect(imagenDePresentacion(undefined)).toBeNull();
    expect(imagenDePresentacion('')).toBeNull();
    expect(imagenDePresentacion('/FRC/resources/images/1.jpg')).toBeNull();
  });
});
