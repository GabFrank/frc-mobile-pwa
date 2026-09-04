import { describe, expect, it } from 'vitest';

import { InventarioProductoItem } from '../domains/inventario/inventario.model';
import {
  estadoDeRevision,
  marcasDeConteo,
  textoDeRevision,
} from '../pages/inventario/revision-item';

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

/**
 * La otra mitad de la regla: quién **escribe** esas marcas.
 *
 * Las pone quien cuenta, no un supervisor aparte, y salen de comparar lo
 * contado contra lo que decía el sistema. Es lo que hace `frc-mobile` al
 * guardar un ítem, y es lo que la pantalla de revisión asume al leerlo.
 */
describe('Marcas al guardar un conteo', () => {
  it('lo que coincide con el sistema queda verificado', () => {
    expect(marcasDeConteo(10, 10)).toEqual({ verificado: true, revisado: false });
  });

  it('lo que no coincide queda modificado', () => {
    // Contar de menos y contar de más son el mismo caso: hubo que corregir.
    expect(marcasDeConteo(7, 10)).toEqual({ verificado: false, revisado: true });
    expect(marcasDeConteo(12, 10)).toEqual({ verificado: false, revisado: true });
  });

  it('contar cero contra un sistema en cero coincide', () => {
    // La góndola vacía y el sistema en cero es un acuerdo, no un ítem sin
    // contar: `0 == 0` tiene que dar verificado y no caer en el caso nulo.
    expect(marcasDeConteo(0, 0)).toEqual({ verificado: true, revisado: false });
  });

  it('un sistema sin dato se compara contra cero', () => {
    // Un ítem sin `cantidadFisica` no tiene stock conocido; contar algo ahí
    // es una diferencia, no una coincidencia.
    expect(marcasDeConteo(4, undefined)).toEqual({ verificado: false, revisado: true });
    expect(marcasDeConteo(0, undefined)).toEqual({ verificado: true, revisado: false });
  });

  /**
   * Regresión: la carga marcaba `verificado: true` siempre. Con eso todo
   * ítem contado se rotulaba «cantidad exacta» en la revisión, incluidos los
   * que tenían diferencia — que son exactamente los que el supervisor busca.
   */
  it('nunca marca las dos, que es la combinación que no significa nada', () => {
    for (const [contado, sistema] of [[10, 10], [7, 10], [0, 0]] as const) {
      const marcas = marcasDeConteo(contado, sistema);
      expect(marcas.verificado && marcas.revisado).toBe(false);
    }
  });
});
