import { describe, expect, it } from 'vitest';

import { UMBRAL_SIMILITUD_VERIFICACION } from '../domains/marcacion/embedding-galeria.util';
import { validarIdentificacion } from '../pages/marcacion/identificacion.util';

/**
 * El 1:N del kiosco: el central dice quién es, y el dispositivo lo comprueba.
 *
 * ⚠️ **Son dos controles, no uno.** `usuarioPorEmbedding` devuelve el mejor
 * match de su caché **y nada del segundo candidato**, así que un 0,71 contra
 * un segundo de 0,69 llega indistinguible de un 0,71 contra un 0,45. Mientras
 * el central no informe el margen —issue #217—, recalcular la similitud acá
 * contra la galería que vino en la respuesta es lo único que queda.
 *
 * Ver la issue #17.
 */
describe('Validar a quién identificó el central', () => {
  const ROSTRO = [1, 0, 0, 0, 0, 0, 0, 0];
  const PARECIDO = [0.9, 0.436, 0, 0, 0, 0, 0, 0];
  const OTRA_PERSONA = [0, 1, 0, 0, 0, 0, 0, 0];

  const galeriaDe = (embedding: number[]) =>
    JSON.stringify({
      master: embedding,
      gallery: [{ pose: 'front', embedding, score: 0.9 }],
    });

  const respuesta = (embeddingGaleria: number[] | null, similitud: number) => ({
    usuario: {
      id: 7,
      nickname: 'FULANO',
      persona: {
        id: 70,
        nombre: 'Fulano de Tal',
        embeddingFacial: embeddingGaleria ? galeriaDe(embeddingGaleria) : null,
      },
    },
    similitud,
  });

  it('sin respuesta no hay identificación', () => {
    expect(validarIdentificacion(ROSTRO, null)).toBeNull();
  });

  it('una respuesta sin usuario no es una identificación', () => {
    expect(validarIdentificacion(ROSTRO, { similitud: 0.9 })).toBeNull();
  });

  it('con las dos similitudes altas, es confiable', () => {
    const id = validarIdentificacion(ROSTRO, respuesta(ROSTRO, 0.9));

    expect(id?.confiable).toBe(true);
    expect(id?.usuario.id).toBe(7);
  });

  it('informa las dos similitudes por separado', () => {
    const id = validarIdentificacion(ROSTRO, respuesta(ROSTRO, 0.82));

    // No es lo mismo lo que dice el central que lo que se puede comprobar acá:
    // guardarlas juntas es lo que permite ver después cuál de las dos falló.
    expect(id?.similitudCentral).toBeCloseTo(0.82);
    expect(id?.similitudLocal).toBeCloseTo(1);
  });

  it('si el central dice que sí pero acá no coincide, no es confiable', () => {
    // El central da 0,9 sobre su caché; recalculado contra la galería que
    // vino, el rostro es de otra persona.
    const id = validarIdentificacion(ROSTRO, respuesta(OTRA_PERSONA, 0.9));

    expect(id?.confiable).toBe(false);
  });

  it('el umbral local es el de verificación, no el de búsqueda', () => {
    // `PARECIDO` da ~0,9 de coseno: pasa el 0,55 de búsqueda y también el
    // 0,75 de verificación. Lo que se fija acá es cuál se usa.
    const id = validarIdentificacion(ROSTRO, respuesta(PARECIDO, 0.9));

    expect(id?.similitudLocal).toBeGreaterThan(0.55);
    expect(id?.similitudLocal).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_VERIFICACION);
    expect(id?.confiable).toBe(true);
  });

  it('apenas por encima del umbral de búsqueda no alcanza para el kiosco', () => {
    // Justo lo que el legacy aceptaba con su 0,55 en las dos puntas. En un
    // dispositivo compartido, un falso positivo marca por otra persona.
    const apenas = [0.62, 0.785, 0, 0, 0, 0, 0, 0];
    const id = validarIdentificacion(ROSTRO, respuesta(apenas, 0.9));

    expect(id!.similitudLocal).toBeGreaterThan(0.55);
    expect(id!.similitudLocal).toBeLessThan(UMBRAL_SIMILITUD_VERIFICACION);
    expect(id!.confiable).toBe(false);
  });

  it('un central poco convencido no se compensa con la comprobación local', () => {
    const id = validarIdentificacion(ROSTRO, respuesta(ROSTRO, 0.4));

    expect(id?.similitudLocal).toBeCloseTo(1);
    expect(id?.confiable).toBe(false);
  });

  it('sin galería en la respuesta no se puede comprobar nada, así que no es confiable', () => {
    const id = validarIdentificacion(ROSTRO, respuesta(null, 0.9));

    expect(id?.similitudLocal).toBe(0);
    expect(id?.confiable).toBe(false);
  });
});
