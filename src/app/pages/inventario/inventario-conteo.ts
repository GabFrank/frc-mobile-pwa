import {
  InventarioProducto,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';

/** Cómo va el conteo de una zona o de todo el inventario. */
export interface ResumenConteo {
  /** Ítems con cantidad contada. */
  contados: number;
  /** De esos, los que quedaron marcados como corregidos por un supervisor. */
  revisados: number;
  /** Suma de las diferencias contado − sistema. */
  diferencia: number;
  /** Ítems donde lo contado no coincide con el sistema. */
  conDiferencia: number;
}

/**
 * Diferencia de un ítem: **lo contado menos lo que dice el sistema**.
 *
 * Positivo es sobrante, negativo es faltante. `null` si todavía no se contó
 * — que no es lo mismo que una diferencia de cero.
 *
 * ⚠️ **Los nombres de los campos están al revés de lo que sugieren.** Lo
 * contado va en `cantidad`; el stock del sistema, en `cantidadFisica`. No es
 * una interpretación: `InventarioGraphQL.finalizarInventarioEnSucursal()`
 * suma `ipi.getCantidad() * presentacion.getCantidad()` y le resta el saldo
 * de `movimiento_stock`, así que `cantidad` **es** el conteo para el central.
 * `frc-mobile` coincide: el campo del diálogo de conteo escribe `cantidad`, y
 * `cantidadFisica`/`cantidadAnterior` guardan el stock al crear el ítem.
 *
 * Leerlo al derecho —como hacía esta función— dejaba el conteo cargado desde
 * la PWA fuera del cálculo de finalización: el central ajustaba el stock
 * contra un número que nadie contó.
 */
export function diferenciaDe(item: InventarioProductoItem): number | null {
  if (item.cantidad == null) {
    return null;
  }
  return item.cantidad - (item.cantidadFisica ?? 0);
}

/**
 * Contado es tener `cantidad`; cero cuenta, `null` no.
 *
 * Un ítem recién sumado a la toma llega con `cantidadFisica` cargada —el
 * stock del sistema— y `cantidad` vacía: trae el número del sistema, pero
 * nadie fue a la góndola todavía.
 *
 * ⚠️ **No hay forma de saber si un ítem se arrastró de una toma anterior.**
 * `frc-mobile` lo marca con `copiedFromItemId`, pero es una marca de memoria
 * de su diálogo de edición: nunca se manda al central, que no tiene dónde
 * guardarla. Pedirla hacía que rechazara la consulta entera.
 */
export function fueContadoEnEstaToma(item: InventarioProductoItem): boolean {
  return item.cantidad != null;
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
