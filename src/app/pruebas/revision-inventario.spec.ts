import { describe, expect, it } from 'vitest';

import { InventarioProductoItem } from '../domains/inventario/inventario.model';
import { estadoDeRevision, textoDeRevision } from '../pages/inventario/revision-item';

const item = (extra: Partial<InventarioProductoItem> = {}): InventarioProductoItem => ({
  id: 1,
  cantidad: 10,
  ...extra,
});

/**
 * `verificado` y `revisado` son dos resultados del mismo paso, no dos pasos.
 * Estos casos fijan que no se lean como una escalera.
 */
describe('Estado de revisión de un ítem', () => {
  it('verificado sin revisar es una cantidad que coincidió', () => {
    expect(estadoDeRevision(item({ verificado: true, revisado: false }))).toBe('exacta');
  });

  it('revisado sin verificar es una cantidad que hubo que corregir', () => {
    expect(estadoDeRevision(item({ verificado: false, revisado: true }))).toBe('modificado');
  });

  it('sin ninguna de las dos, nadie lo tocó', () => {
    expect(estadoDeRevision(item({ verificado: false, revisado: false }))).toBe('sinEstado');
  });

  it('con las dos no dice nada: el central no genera esa combinación', () => {
    // Si apareciera, es dato inconsistente. Rotularlo de un lado sería
    // elegir por el supervisor sin saber cuál pasó.
    expect(estadoDeRevision(item({ verificado: true, revisado: true }))).toBe('sinEstado');
  });

  /**
   * El central resuelve el orden con `revisado = false OR revisado IS NULL`.
   * Si acá `null` no contara como `false`, un ítem con la columna vacía
   * saldría **primero** en la lista y rotulado «sin revisar»: el orden
   * diciendo una cosa y el cartel otra.
   */
  it('trata null igual que false, como el ORDER BY del central', () => {
    expect(estadoDeRevision(item({ verificado: true }))).toBe('exacta');
    expect(estadoDeRevision(item({ revisado: true }))).toBe('modificado');
  });

  it('sin ítem no inventa un estado', () => {
    expect(estadoDeRevision(null)).toBe('sinEstado');
    expect(estadoDeRevision(undefined)).toBe('sinEstado');
  });

  it('cada estado tiene su texto', () => {
    expect(textoDeRevision('exacta')).toBe('Cantidad exacta');
    expect(textoDeRevision('modificado')).toBe('Modificado');
    expect(textoDeRevision('sinEstado')).toBe('Sin revisar');
  });
});
