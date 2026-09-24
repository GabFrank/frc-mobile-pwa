import { describe, expect, it } from 'vitest';

import type { ProductoVencido } from '../domains/productos/producto-vencido.model';
import {
  origenDeSugerencia,
  vencimientoSugerido,
} from '../pages/inventario/vencimiento-sugerido';

const HOY = new Date('2026-08-25T12:00:00');

const fila = (extra: Partial<ProductoVencido>): ProductoVencido => ({
  presentacionId: 9,
  fuenteVerdad: 'INVENTARIO',
  ...extra,
});

/**
 * El vencimiento que la app propone al contar.
 *
 * ⚠️ **La elección de la fuente ya la hace el central.** `productosVencidos`
 * unifica inventario, compra y transferencia y se queda con una fila por
 * presentación y fecha: gana una compra o transferencia **posterior** al
 * último inventario, y si no, la fuente más reciente. Acá solo se decide
 * cuál de las fechas que sobrevivieron va al campo.
 */
describe('Vencimiento sugerido para una presentación', () => {
  it('elige el más próximo a vencer', () => {
    const sugerido = vencimientoSugerido(
      [
        fila({ vencimiento: '2027-01-15' }),
        fila({ vencimiento: '2026-09-30' }),
        fila({ vencimiento: '2026-12-01' }),
      ],
      9,
      HOY,
    );
    // Es el que le importa a quien cuenta: si hay algo por vencer en la
    // góndola, es eso.
    expect(sugerido?.fecha).toBe('2026-09-30');
    expect(sugerido?.vencido).toBe(false);
  });

  it('ignora las de otra presentación', () => {
    // El conteo es por presentación: la caja x12 y la unidad son lotes
    // distintos y pueden vencer en fechas distintas.
    const sugerido = vencimientoSugerido(
      [fila({ presentacionId: 8, vencimiento: '2026-09-01' }), fila({ vencimiento: '2026-12-01' })],
      9,
      HOY,
    );
    expect(sugerido?.fecha).toBe('2026-12-01');
  });

  it('prefiere el más próximo que todavía no venció', () => {
    // Uno de 2024 es mercadería que ya se sacó o se perdió; prellenarlo en
    // silencio arrastraría chatarra a cada toma nueva.
    const sugerido = vencimientoSugerido(
      [fila({ vencimiento: '2024-03-01' }), fila({ vencimiento: '2026-11-20' })],
      9,
      HOY,
    );
    expect(sugerido?.fecha).toBe('2026-11-20');
    expect(sugerido?.vencido).toBe(false);
  });

  it('si todos vencieron devuelve el más próximo, pero marcado', () => {
    // Hay mercadería caduca en esa zona y el conteo tiene que registrarla.
    // Lo que no se hace es prellenar una fecha pasada sin decirlo.
    const sugerido = vencimientoSugerido(
      [fila({ vencimiento: '2024-03-01' }), fila({ vencimiento: '2025-06-10' })],
      9,
      HOY,
    );
    expect(sugerido?.fecha).toBe('2025-06-10');
    expect(sugerido?.vencido).toBe(true);
  });

  it('lo que vence hoy todavía no venció', () => {
    const sugerido = vencimientoSugerido([fila({ vencimiento: '2026-08-25' })], 9, HOY);
    expect(sugerido?.vencido).toBe(false);
  });

  it('sin filas no inventa una fecha', () => {
    expect(vencimientoSugerido([], 9, HOY)).toBeNull();
    expect(vencimientoSugerido(undefined, 9, HOY)).toBeNull();
  });

  it('una fila sin fecha no cuenta', () => {
    expect(vencimientoSugerido([fila({ vencimiento: undefined })], 9, HOY)).toBeNull();
  });

  it('la época Unix es una fecha ausente, no un vencimiento de 1970', () => {
    const sugerido = vencimientoSugerido(
      [fila({ vencimiento: '1970-01-01 00:00' }), fila({ vencimiento: '2026-11-20' })],
      9,
      HOY,
    );
    expect(sugerido?.fecha).toBe('2026-11-20');
  });

  it('recorta la hora: el campo del formulario es una fecha', () => {
    const sugerido = vencimientoSugerido([fila({ vencimiento: '2026-11-20 03:00' })], 9, HOY);
    expect(sugerido?.fecha).toBe('2026-11-20');
  });

  it('los ids llegan como número o como texto desde GraphQL', () => {
    const desdeGraphql = [{ presentacionId: '9', vencimiento: '2026-11-20' }] as unknown as ProductoVencido[];
    expect(vencimientoSugerido(desdeGraphql, 9, HOY)?.fecha).toBe('2026-11-20');
  });
});

describe('De dónde salió la fecha que se ofrece', () => {
  it('usa el detalle que arma el central', () => {
    const texto = origenDeSugerencia({
      fecha: '2026-11-20',
      vencido: false,
      fuente: 'COMPRA',
      detalle: 'Nota de compra #123 (15/03/2026)',
    });
    expect(texto).toContain('Nota de compra #123');
  });

  it('sin detalle nombra la fuente, que es lo mínimo que hay que saber', () => {
    // Una fecha suelta no deja decidir si creerle.
    expect(
      origenDeSugerencia({ fecha: '2026-11-20', vencido: false, fuente: 'TRANSFERENCIA' }),
    ).toContain('transferencia');
  });

  it('sin fuente tampoco afirma de dónde salió', () => {
    expect(origenDeSugerencia({ fecha: '2026-11-20', vencido: false })).toBe(
      'un registro anterior',
    );
  });
});
