import { describe, expect, it } from 'vitest';

import {
  EmbeddingGaleria,
  FrameCalidadFacial,
  UMBRAL_SIMILITUD_FRAME_VERIFICACION,
  UMBRAL_SIMILITUD_VERIFICACION,
  confirmarVerificacionFinal,
  mejorSimilitudConGaleria,
} from '../domains/marcacion/embedding-galeria.util';

/**
 * La verificación 1:1, con los umbrales del desktop (issue #144).
 *
 * Un frame suelto es ruidoso: con la persona correcta da mediana 0,84 y el
 * promedio de varios frames 0,89. Por eso cada frame cuenta desde 0,70 y la
 * decisión final se toma sobre el embedding promedio, con 0,75.
 */
describe('Verificación 1:1: umbral por frame y umbral final', () => {
  const unitario = (v: number[]) => {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return v.map((x) => x / n);
  };
  const REF = [1, 0, 0, 0];
  const galeria: EmbeddingGaleria = { master: REF, gallery: [{ pose: 'front', embedding: REF, score: 1 }] };

  /** Un frame con coseno `c` contra la referencia, rotado hacia el eje `eje`. */
  const frame = (c: number, eje = 1): FrameCalidadFacial => {
    const v = [c, 0, 0, 0];
    v[eje] = Math.sqrt(1 - c * c);
    const embedding = unitario(v);
    return { embedding, score: 0.9, similitud: mejorSimilitudConGaleria(embedding, galeria) };
  };

  it('los umbrales son los del desktop', () => {
    expect(UMBRAL_SIMILITUD_FRAME_VERIFICACION).toBe(0.7);
    expect(UMBRAL_SIMILITUD_VERIFICACION).toBe(0.75);
  });

  it('frames de 0,72 que se desvían para lados distintos promedian por encima de 0,75 y pasan', () => {
    // Cada frame solo no llega a 0,75; el promedio sí, porque el ruido se cancela.
    const frames = [frame(0.72, 1), frame(0.72, 2), frame(0.72, 3)];

    const r = confirmarVerificacionFinal(frames, galeria);

    expect(r).not.toBeNull();
    expect(r!.similitud).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_VERIFICACION);
  });

  it('frames de 0,72 que se desvían todos para el mismo lado no llegan a 0,75 y no pasan', () => {
    const frames = [frame(0.72, 1), frame(0.72, 1), frame(0.72, 1)];

    expect(confirmarVerificacionFinal(frames, galeria)).toBeNull();
  });

  it('un frame por debajo de 0,70 no cuenta, y con dos válidos no alcanza', () => {
    const frames = [frame(0.95, 1), frame(0.95, 2), frame(0.65, 3)];

    expect(confirmarVerificacionFinal(frames, galeria)).toBeNull();
  });
});
