import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { EstadoDevolucion, TipoDevolucion } from './devolucion.enums';

/** Proveedor, mínimo. El módulo de personas todavía no está portado. */
export interface ProveedorRef {
  id?: number;
  persona?: { nombre?: string; documento?: string };
}

/**
 * Motivo por el que el producto se devuelve.
 *
 * ⚠️ **`generaGasto` y `aplicaProveedor` deciden el destino económico.** Un
 * motivo con `aplicaProveedor: false` —rotura por mal manejo interno— no
 * puede terminar en `ACREDITADO`: la pérdida es de la empresa. Vienen del
 * backend con sus flags; no se hardcodean.
 */
export interface MotivoAveria {
  id?: number;
  descripcion?: string;
  activo?: boolean;
  generaGasto?: boolean;
  aplicaProveedor?: boolean;
}

export interface DevolucionItem {
  id?: number;
  producto?: Producto;
  presentacion?: Presentacion;
  motivoAveria?: MotivoAveria;
  cantidad?: number;
  motivo?: string;
  lote?: string;
  vencimiento?: string;
  costoUnitario?: number;
  /** Producto que vuelve a stock tras un canje. */
  cantidadReingresada?: number;
  vencimientoReingreso?: string;
}

export interface Devolucion {
  id?: number;
  tipo?: TipoDevolucion;
  proveedor?: ProveedorRef;
  /** Dónde se detectó. No cambia. */
  sucursalOrigen?: Sucursal;
  /** Dónde está **ahora**. Se actualiza al colectar. */
  sucursalUbicacion?: Sucursal;
  colectadoEn?: string;
  /** Código de la caja o bulto físico. */
  identificador?: string;
  fecha?: string;
  motivo?: string;
  estado?: EstadoDevolucion;
  observacion?: string;
  items?: DevolucionItem[];
}

export interface DevolucionItemInput {
  id?: number;
  devolucionId?: number;
  productoId: number;
  presentacionId: number;
  motivoAveriaId: number;
  cantidad: number;
  motivo?: string;
  lote?: string;
  vencimiento?: string;
  costoUnitario?: number;
  cantidadReingresada?: number;
  vencimientoReingreso?: string;
}

export interface DevolucionInput {
  id?: number;
  tipo: TipoDevolucion;
  proveedorId?: number;
  sucursalOrigenId: number;
  fecha: string;
  motivo?: string;
  estado: EstadoDevolucion;
  observacion?: string;
  usuarioId: number;
  items: DevolucionItemInput[];
}

/**
 * Fila de trabajo mientras se cargan productos, **antes** de armar el input.
 *
 * No es una entidad del backend: existe solo en la pantalla. Guarda el
 * producto y la presentación enteros —no sus ids— porque la lista los muestra
 * mientras se edita.
 */
export interface DevolucionItemDraft {
  producto: Producto;
  presentacion: Presentacion;
  motivoAveria?: MotivoAveria;
  cantidad: number;
  lote?: string;
  vencimiento?: string;
  motivo?: string;
}
