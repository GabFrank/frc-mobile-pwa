import type { Producto } from 'src/app/domains/productos/producto.model';

/**
 * En qué situación está un lote.
 *
 * ⚠️ **No es stock.** Un lote `BLOQUEADO` sigue teniendo existencia física y
 * se cuenta igual en el inventario: lo que cambia es que no se puede vender ni
 * lo elige FEFO. Bloquear es el mecanismo de recall.
 */
export enum EstadoLote {
  LIBERADO = 'LIBERADO',
  CUARENTENA = 'CUARENTENA',
  BLOQUEADO = 'BLOQUEADO',
}

export const ESTADO_LOTE_TEXTO: Record<EstadoLote, string> = {
  [EstadoLote.LIBERADO]: 'Liberado',
  [EstadoLote.CUARENTENA]: 'En cuarentena',
  [EstadoLote.BLOQUEADO]: 'Bloqueado',
};

/**
 * El maestro del lote.
 *
 * ⚠️ **Hay uno solo por `(producto, número de lote)` en toda la red**, y
 * replica `MAIN_TO_ALL`. Corregirle una fecha no es un dato de esta sucursal:
 * reordena el FEFO en todas. La pantalla que lo edita tiene que decirlo.
 *
 * ⚠️ **`fechaRetiro` es la que ordena FEFO, no `fechaVencimiento`.** Se deriva
 * de `producto.diasVencimiento` cuando nadie la carga a mano: la idea es sacar
 * la mercadería antes de que venza, no el último día.
 */
export interface Lote {
  id?: number;
  producto?: Producto;
  numeroLote?: string;
  fechaVencimiento?: string;
  fechaRetiro?: string;
  fechaFabricacion?: string;
  estado?: EstadoLote;
  observacion?: string;
}

/**
 * Un lote de un producto con su saldo en una sucursal.
 *
 * ⚠️ **`saldo` en cero no quiere decir que el lote no sirva.** Son justamente
 * los que hacen falta para atribuir mercadería que está en la góndola sin lote
 * asignado, así que el buscador los lista igual. `saldoTotal` distingue «acá no
 * hay» de «no hay en ningún lado».
 */
export interface LoteDeProducto {
  loteId?: number;
  numeroLote?: string;
  fechaVencimiento?: string;
  fechaRetiro?: string;
  estado?: EstadoLote;
  saldo?: number;
  saldoTotal?: number;
}

/**
 * Saldo disponible de un lote en una sucursal, en **unidades base**.
 *
 * ⚠️ La conversión a la presentación con la que cuenta el operador la hace la
 * pantalla dividiendo por `presentacion.cantidad`: el ledger lleva unidades y
 * el conteo se carga en cajas o packs.
 */
export interface StockLote {
  loteId?: number;
  productoId?: number;
  numeroLote?: string;
  fechaVencimiento?: string;
  fechaRetiro?: string;
  estado?: EstadoLote;
  cantidadDisponible?: number;
}

/**
 * Saldo de un lote **expresado en la presentación con la que carga el
 * operador**, tal como lo devuelve `stockPorLoteEnPresentacion`.
 *
 * ⚠️ **Acá no se divide nada.** A diferencia de [`StockLote`](#StockLote), la
 * conversión ya viene resuelta del central: es la misma regla con la que
 * después reparte el stock al guardar el ítem, y tenerla también en la
 * pantalla sería tenerla en dos lados.
 *
 * ⚠️ **`cantidadDisponiblePresentacion` son presentaciones COMPLETAS** y
 * `unidadesSobrantes` lo que queda fuera de ellas. Un lote con 20 unidades y
 * presentación «caja x 6» da 3 cajas y sobran 2: mostrar solo el 3 haría
 * pensar que esas 2 unidades no existen.
 */
export interface StockLotePresentacion {
  loteId?: number;
  numeroLote?: string;
  fechaVencimiento?: string;
  fechaRetiro?: string;
  estado?: EstadoLote;
  /** Saldo en unidades base, como vive en el ledger. */
  cantidadDisponible?: number;
  /** Presentaciones completas que entran en ese saldo. */
  cantidadDisponiblePresentacion?: number;
  /** Unidades que quedan fuera de esas presentaciones completas. */
  unidadesSobrantes?: number;
  unidadesPorPresentacion?: number;
  presentacionDescripcion?: string;
}

/** Lo que se manda para dar de alta un lote. */
export interface CrearLoteInput {
  productoId: number;
  numeroLote: string;
  /** `yyyy-MM-dd`. Opcional: hay productos con lote y sin vencimiento. */
  fechaVencimiento?: string | null;
  /** `yyyy-MM-dd`. Sin esto el central la deriva de `producto.diasVencimiento`. */
  fechaRetiro?: string | null;
  observacion?: string;
  usuarioId?: number;
}

/** Lo que se manda para corregir las fechas del maestro. */
export interface FechasLoteInput {
  loteId: number;
  /** `yyyy-MM-dd`. Un nulo **no borra**: significa «no lo mandé». */
  fechaVencimiento?: string | null;
  fechaRetiro?: string | null;
  motivo?: string;
  usuarioId?: number;
}
