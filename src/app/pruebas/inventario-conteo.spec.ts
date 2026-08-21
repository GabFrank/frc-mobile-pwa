import { describe, expect, it } from 'vitest';

import { InventarioProductoItem } from '../domains/inventario/inventario.model';
import {
  diferenciaDe,
  fueContadoEnEstaToma,
  productosConcluidos,
  resumirInventario,
  resumirItems,
} from '../pages/inventario/inventario-conteo';

const item = (extra: Partial<InventarioProductoItem> = {}): InventarioProductoItem => ({
  id: 1,
  cantidad: 10,
  ...extra,
});

/**
 * La diferencia **es** el resultado del inventario. Estos casos fijan que no
 * se confunda con un error, ni se mezcle lo contado con lo arrastrado de una
 * toma anterior.
 */
describe('Diferencia de un ítem', () => {
  it('es lo contado menos lo que dice el sistema', () => {
    expect(diferenciaDe(item({ cantidad: 10, cantidadFisica: 7 }))).toBe(-3);
    expect(diferenciaDe(item({ cantidad: 10, cantidadFisica: 12 }))).toBe(2);
  });

  it('sin contar es null, que no es lo mismo que cero', () => {
    // Cero significa «contado y coincide»; null, «todavía no se contó».
    expect(diferenciaDe(item({ cantidadFisica: undefined }))).toBeNull();
    expect(diferenciaDe(item({ cantidad: 10, cantidadFisica: 10 }))).toBe(0);
  });

  it('sin cantidad del sistema, lo contado es todo sobrante', () => {
    expect(diferenciaDe(item({ cantidad: undefined, cantidadFisica: 5 }))).toBe(5);
  });
});

describe('Qué se contó en esta toma', () => {
  it('un ítem contado cuenta', () => {
    expect(fueContadoEnEstaToma(item({ cantidadFisica: 5 }))).toBe(true);
  });

  it('un ítem arrastrado de otra toma no', () => {
    // `copiedFromItemId` marca lo que se copió de un inventario anterior:
    // nadie lo tocó en esta toma.
    expect(fueContadoEnEstaToma(item({ cantidadFisica: 5, copiedFromItemId: 99 }))).toBe(false);
  });

  it('un ítem sin contar tampoco', () => {
    expect(fueContadoEnEstaToma(item())).toBe(false);
  });
});

describe('Resumen del conteo', () => {
  it('separa lo contado de lo arrastrado', () => {
    const resumen = resumirItems([
      item({ id: 1, cantidad: 10, cantidadFisica: 10 }),
      item({ id: 2, cantidad: 5, cantidadFisica: 3 }),
      item({ id: 3, cantidad: 8, cantidadFisica: 8, copiedFromItemId: 50 }),
      item({ id: 4 }),
    ]);

    // Contados: solo el 1 y el 2. El 3 se arrastró; el 4 no se contó.
    expect(resumen.contados).toBe(2);
    expect(resumen.arrastrados).toBe(1);
  });

  it('suma las diferencias y cuenta cuántos ítems las tienen', () => {
    const resumen = resumirItems([
      item({ id: 1, cantidad: 10, cantidadFisica: 7 }),
      item({ id: 2, cantidad: 5, cantidadFisica: 6 }),
      item({ id: 3, cantidad: 4, cantidadFisica: 4 }),
    ]);

    expect(resumen.conDiferencia).toBe(2);
    expect(resumen.diferencia).toBe(-2);
  });

  it('un ítem revisado también está contado', () => {
    // Son etapas sucesivas: primero se cuenta, después se revisa.
    const resumen = resumirItems([item({ cantidadFisica: 10, revisado: true })]);
    expect(resumen.contados).toBe(1);
    expect(resumen.revisados).toBe(1);
  });

  it('lo arrastrado no aporta a la diferencia', () => {
    const resumen = resumirItems([
      item({ id: 1, cantidad: 10, cantidadFisica: 2, copiedFromItemId: 7 }),
    ]);
    expect(resumen.diferencia).toBe(0);
    expect(resumen.conDiferencia).toBe(0);
  });

  it('una lista vacía no rompe', () => {
    expect(resumirItems([]).contados).toBe(0);
    expect(resumirInventario([]).contados).toBe(0);
  });

  it('resume todos los productos juntos', () => {
    const resumen = resumirInventario([
      { id: 1, inventarioProductoItemList: [item({ cantidad: 10, cantidadFisica: 8 })] },
      { id: 2, inventarioProductoItemList: [item({ cantidad: 5, cantidadFisica: 6 })] },
    ]);
    expect(resumen.contados).toBe(2);
    expect(resumen.diferencia).toBe(-1);
  });
});

describe('Productos concluidos', () => {
  it('cuenta los marcados', () => {
    expect(productosConcluidos([{ id: 1, concluido: true }, { id: 2 }, { id: 3, concluido: true }])).toBe(2);
  });
});
