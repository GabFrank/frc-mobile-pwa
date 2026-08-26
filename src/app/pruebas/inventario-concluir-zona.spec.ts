import { describe, expect, it } from 'vitest';

import type {
  InventarioProducto,
  InventarioProductoItem,
} from '../domains/inventario/inventario.model';
import { motivoNoConcluir, motivoNoFinalizar } from '../pages/inventario/inventario-conteo';

/**
 * Qué impide dar una zona por contada.
 *
 * Una zona concluida dice «acá ya se contó todo». Si queda un renglón sin
 * cantidad, esa afirmación es falsa y además tiene consecuencia real: el central
 * saltea los ítems sin contar al finalizar, así que ese producto **no se ajusta**
 * y nadie se entera.
 *
 * ⚠️ **Contar cero no es lo mismo que no contar.** El cero dice «no hay nada en
 * la góndola» y ajusta el stock; el vacío dice «nadie fue a mirar». La regla
 * tiene que dejar pasar el primero y frenar el segundo.
 */
describe('Concluir una zona', () => {
  const item = (
    id: number,
    descripcion: string,
    cantidad: number | null,
    opciones?: { productoConLote?: boolean; conLote?: boolean },
  ): InventarioProductoItem =>
    ({
      id,
      cantidad: cantidad ?? undefined,
      presentacion: {
        id: 9,
        cantidad: 1,
        producto: { id: id * 10, descripcion, lote: opciones?.productoConLote === true },
      },
      lote: opciones?.conLote ? { id: 41, numeroLote: 'L-2026-88' } : undefined,
    }) as InventarioProductoItem;

  it('con todo contado deja concluir', () => {
    expect(motivoNoConcluir([item(1, 'COCA COLA 2L', 6), item(2, 'AZUCAR 1KG', 3)])).toBeNull();
  });

  it('contar cero deja concluir: cero es un conteo', () => {
    expect(motivoNoConcluir([item(1, 'COCA COLA 2L', 0)])).toBeNull();
  });

  it('una zona vacía deja concluir', () => {
    // No hay nada que contar; frenarla dejaría la zona trabada para siempre.
    expect(motivoNoConcluir([])).toBeNull();
  });

  it('un renglón sin contar lo impide y lo nombra', () => {
    const motivo = motivoNoConcluir([item(1, 'COCA COLA 2L', 6), item(2, 'DUCOCO AGUA', null)]);

    expect(motivo).not.toBeNull();
    expect(motivo).toContain('DUCOCO AGUA');
    // El que sí se contó no tiene por qué aparecer en el reclamo.
    expect(motivo).not.toContain('COCA COLA');
  });

  it('con muchos sin contar nombra unos pocos y dice cuántos quedan', () => {
    const motivo = motivoNoConcluir([
      item(1, 'UNO', null),
      item(2, 'DOS', null),
      item(3, 'TRES', null),
      item(4, 'CUATRO', null),
      item(5, 'CINCO', null),
    ]);

    expect(motivo).toContain('5');
    expect(motivo).toContain('UNO');
    // Cinco descripciones no entran en un toast de teléfono.
    expect(motivo).not.toContain('CINCO');
  });

  it('el renglón sin lote dice que primero hay que elegir el lote', () => {
    // No es «te olvidaste de contarlo»: el campo está bloqueado y no se puede
    // contar hasta asignarle un lote. Mandar al operador a escribir una
    // cantidad que no puede escribir lo deja sin salida.
    const motivo = motivoNoConcluir([
      item(1, 'PILSEN LATA', null, { productoConLote: true, conLote: false }),
    ]);

    expect(motivo).toContain('lote');
    expect(motivo).toContain('PILSEN LATA');
  });

  it('un renglón con lote sin contar es un olvido común, no un problema de lote', () => {
    const motivo = motivoNoConcluir([
      item(1, 'PILSEN LATA', null, { productoConLote: true, conLote: true }),
    ]);

    expect(motivo).not.toContain('lote');
  });
});

/**
 * Qué impide finalizar la toma.
 *
 * Finalizar **ajusta el stock**: el central crea los movimientos que llevan la
 * existencia de hoy a lo que se contó. Hacerlo con una zona todavía abierta
 * significa ajustar contra un conteo a medio hacer, y no hay vuelta atrás
 * — reabrir la toma no deshace los ajustes ya escritos.
 */
describe('Finalizar la toma', () => {
  const zona = (id: number, descripcion: string, concluido: boolean): InventarioProducto =>
    ({ id, concluido, zona: { id: id * 10, descripcion } }) as InventarioProducto;

  it('con todas las zonas concluidas deja finalizar', () => {
    expect(
      motivoNoFinalizar([zona(1, 'estante alto', true), zona(2, 'deposito', true)]),
    ).toBeNull();
  });

  it('una zona sin concluir lo impide y la nombra', () => {
    const motivo = motivoNoFinalizar([zona(1, 'estante alto', true), zona(2, 'gondola 3', false)]);

    expect(motivo).not.toBeNull();
    expect(motivo).toContain('gondola 3');
    expect(motivo).not.toContain('estante alto');
  });

  it('con muchas sin concluir nombra unas pocas y dice cuántas quedan', () => {
    const motivo = motivoNoFinalizar([
      zona(1, 'UNA', false),
      zona(2, 'DOS', false),
      zona(3, 'TRES', false),
      zona(4, 'CUATRO', false),
    ]);

    expect(motivo).toContain('4');
    expect(motivo).toContain('UNA');
    expect(motivo).not.toContain('CUATRO');
  });

  it('una toma sin zonas no se traba', () => {
    // No hay ninguna zona abierta que concluir. Frenarla la dejaría sin forma
    // de cerrarse ni de cancelarse desde el teléfono.
    expect(motivoNoFinalizar([])).toBeNull();
  });
});
