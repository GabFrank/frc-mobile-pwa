import {
  InventarioProducto,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';

/** Cómo va el conteo de un producto o de todo el inventario. */
export interface ResumenConteo {
  /** Ítems contados en **esta** toma. */
  contados: number;
  /** De esos, los que ya pasó a revisar un supervisor. */
  revisados: number;
  /** Arrastrados de una toma anterior: no se contaron ahora. */
  arrastrados: number;
  /** Suma de las diferencias sistema − contado. */
  diferencia: number;
  /** Ítems donde lo contado no coincide con el sistema. */
  conDiferencia: number;
}

/**
 * Diferencia de un ítem: **lo contado menos lo que dice el sistema**.
 *
 * Positivo es sobrante, negativo es faltante. `null` si todavía no se contó
 * — que no es lo mismo que una diferencia de cero.
 */
export function diferenciaDe(item: InventarioProductoItem): number | null {
  if (item.cantidadFisica == null) {
    return null;
  }
  return item.cantidadFisica - (item.cantidad ?? 0);
}

/**
 * ⚠️ **Un ítem copiado de una toma anterior no se contó ahora.**
 * `copiedFromItemId` lo marca, y hay que excluirlo de la cobertura del
 * conteo: contarlo como hecho haría creer que se recorrió mercadería que
 * nadie tocó.
 */
export function fueContadoEnEstaToma(item: InventarioProductoItem): boolean {
  return item.copiedFromItemId == null && item.cantidadFisica != null;
}

/** Resume una lista de ítems sin mezclar lo contado con lo arrastrado. */
export function resumirItems(items: InventarioProductoItem[]): ResumenConteo {
  const resumen: ResumenConteo = {
    contados: 0,
    revisados: 0,
    arrastrados: 0,
    diferencia: 0,
    conDiferencia: 0,
  };

  for (const item of items ?? []) {
    if (item.copiedFromItemId != null) {
      resumen.arrastrados += 1;
      continue;
    }
    if (!fueContadoEnEstaToma(item)) {
      continue;
    }
    resumen.contados += 1;
    if (item.revisado) {
      resumen.revisados += 1;
    }
    const dif = diferenciaDe(item) ?? 0;
    if (dif !== 0) {
      resumen.conDiferencia += 1;
      resumen.diferencia += dif;
    }
  }

  return resumen;
}

/** Ídem sobre todos los productos del inventario. */
export function resumirInventario(productos: InventarioProducto[]): ResumenConteo {
  const todos = (productos ?? []).flatMap((p) => p.inventarioProductoItemList ?? []);
  return resumirItems(todos);
}

/** Cuántos productos quedaron marcados como concluidos. */
export function productosConcluidos(productos: InventarioProducto[]): number {
  return (productos ?? []).filter((p) => p.concluido).length;
}
