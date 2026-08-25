import { describe, expect, it } from 'vitest';

import { InventarioProductoItem } from '../domains/inventario/inventario.model';
import {
  diferenciaDe,
  fueContadoEnEstaToma,
  productosConcluidos,
  resumirInventario,
  resumirItems,
} from '../pages/inventario/inventario-conteo';

/**
 * ⚠️ **`cantidad` es lo contado y `cantidadFisica` lo que dice el sistema**,
 * al revés de lo que sugieren los nombres.
 *
 * No es una interpretación: `InventarioGraphQL.finalizarInventarioEnSucursal()`
 * suma `ipi.getCantidad() * presentacion.getCantidad()` y le resta el saldo
 * de `movimiento_stock`. El campo que el central toma como conteo es
 * `cantidad`. `frc-mobile` coincide: el input del diálogo de conteo escribe
 * `cantidad`, y `cantidadFisica`/`cantidadAnterior` guardan el stock del
 * sistema al momento de crear el ítem.
 *
 * Un ítem sin contar llega entonces con `cantidad` nula y `cantidadFisica`
 * cargada, que es justo la forma en que lo crea la app cuando se suma un
 * producto a la toma.
 */
const item = (extra: Partial<InventarioProductoItem> = {}): InventarioProductoItem => ({
  id: 1,
  cantidadFisica: 10,
  ...extra,
});

describe('Diferencia de un ítem', () => {
  it('es lo contado menos lo que dice el sistema', () => {
    expect(diferenciaDe(item({ cantidadFisica: 10, cantidad: 7 }))).toBe(-3);
    expect(diferenciaDe(item({ cantidadFisica: 10, cantidad: 12 }))).toBe(2);
  });

  it('la calcula con el mismo campo que el central suma al finalizar', () => {
    // Regresión: la PWA escribía el conteo en `cantidadFisica` y dejaba
    // `cantidad` como vino, así que `finalizarInventario` —que suma
    // `cantidad`— ignoraba todo lo contado desde el teléfono y ajustaba el
    // stock contra un número que nadie contó. Los dos campos van distintos
    // a propósito: si la función leyera uno por otro, el signo se invierte.
    const contadoDeMenos = item({ cantidad: 3, cantidadFisica: 8 });
    expect(diferenciaDe(contadoDeMenos)).toBe(-5);
  });

  it('sin contar es null, que no es lo mismo que cero', () => {
    // Cero significa «contado y coincide»; null, «todavía no se contó».
    expect(diferenciaDe(item({ cantidad: undefined }))).toBeNull();
    expect(diferenciaDe(item({ cantidadFisica: 10, cantidad: 10 }))).toBe(0);
  });

  it('sin stock del sistema, lo contado es todo sobrante', () => {
    expect(diferenciaDe(item({ cantidadFisica: undefined, cantidad: 5 }))).toBe(5);
  });
});

describe('Qué se contó en esta toma', () => {
  it('un ítem contado cuenta', () => {
    expect(fueContadoEnEstaToma(item({ cantidad: 5 }))).toBe(true);
  });

  it('contado en cero también cuenta', () => {
    // Cero es un resultado del conteo: la góndola estaba vacía.
    expect(fueContadoEnEstaToma(item({ cantidad: 0 }))).toBe(true);
  });

  it('un ítem sin contar no', () => {
    // Trae el stock del sistema, pero nadie fue a la góndola todavía.
    expect(fueContadoEnEstaToma(item())).toBe(false);
  });
});

describe('Resumen del conteo', () => {
  it('separa lo contado de lo que falta contar', () => {
    const resumen = resumirItems([
      item({ id: 1, cantidadFisica: 10, cantidad: 10 }),
      item({ id: 2, cantidadFisica: 5, cantidad: 3 }),
      item({ id: 3, cantidadFisica: 8 }),
      item({ id: 4, cantidadFisica: undefined }),
    ]);

    // Contados: solo el 1 y el 2. Los otros dos siguen sin contar.
    expect(resumen.contados).toBe(2);
  });

  it('suma las diferencias y cuenta cuántos ítems las tienen', () => {
    const resumen = resumirItems([
      item({ id: 1, cantidadFisica: 10, cantidad: 7 }),
      item({ id: 2, cantidadFisica: 5, cantidad: 6 }),
      item({ id: 3, cantidadFisica: 4, cantidad: 4 }),
    ]);

    expect(resumen.conDiferencia).toBe(2);
    expect(resumen.diferencia).toBe(-2);
  });

  it('un ítem revisado también está contado', () => {
    const resumen = resumirItems([item({ cantidad: 10, revisado: true })]);
    expect(resumen.contados).toBe(1);
    expect(resumen.revisados).toBe(1);
  });

  it('lo que no se contó no aporta a la diferencia', () => {
    // Sin conteo no hay diferencia que reportar: falta contarlo, no es que
    // coincida con el sistema.
    const resumen = resumirItems([item({ id: 1, cantidadFisica: 10 })]);
    expect(resumen.diferencia).toBe(0);
    expect(resumen.conDiferencia).toBe(0);
  });

  it('una lista vacía no rompe', () => {
    expect(resumirItems([]).contados).toBe(0);
    expect(resumirInventario([]).contados).toBe(0);
  });

  it('resume todas las zonas juntas', () => {
    const resumen = resumirInventario([
      { id: 1, inventarioProductoItemList: [item({ cantidadFisica: 10, cantidad: 8 })] },
      { id: 2, inventarioProductoItemList: [item({ cantidadFisica: 5, cantidad: 6 })] },
    ]);
    expect(resumen.contados).toBe(2);
    expect(resumen.diferencia).toBe(-1);
  });
});

describe('Zonas concluidas', () => {
  it('cuenta los marcados', () => {
    expect(productosConcluidos([{ id: 1, concluido: true }, { id: 2 }, { id: 3, concluido: true }])).toBe(2);
  });
});
