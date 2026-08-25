import {
  InventarioProducto,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';

/** Cómo va el conteo de una zona o de todo el inventario. */
export interface ResumenConteo {
  /** Ítems con cantidad contada. */
  contados: number;
  /** De esos, los que ya pasó a revisar un supervisor. */
  revisados: number;
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
 * Contado es tener `cantidadFisica`; cero cuenta, `null` no.
 *
 * ⚠️ **No hay forma de saber si un ítem se arrastró de una toma anterior.**
 * `frc-mobile` lo marca con `copiedFromItemId`, pero es una marca de memoria
 * de su diálogo de edición: nunca se manda al central, que no tiene dónde
 * guardarla. Pedirla hacía que rechazara la consulta entera.
 */
export function fueContadoEnEstaToma(item: InventarioProductoItem): boolean {
  return item.cantidadFisica != null;
}

/** Resume una lista de ítems. */
export function resumirItems(items: InventarioProductoItem[]): ResumenConteo {
  const resumen: ResumenConteo = {
    contados: 0,
    revisados: 0,
    diferencia: 0,
    conDiferencia: 0,
  };

  for (const item of items ?? []) {
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

/** Ídem sobre todas las zonas del inventario. */
export function resumirInventario(productos: InventarioProducto[]): ResumenConteo {
  const todos = (productos ?? []).flatMap((p) => p.inventarioProductoItemList ?? []);
  return resumirItems(todos);
}

/** Cuántas zonas quedaron marcadas como concluidas. */
export function productosConcluidos(productos: InventarioProducto[]): number {
  return (productos ?? []).filter((p) => p.concluido).length;
}
