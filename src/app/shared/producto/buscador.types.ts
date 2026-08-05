import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { AccionProducto } from './producto-card.component';

/**
 * Qué devuelve el buscador al elegir.
 *
 * En `frc-mobile` esto no existía: siempre había que abrir el acordeón y
 * tocar una presentación, y los dos usos que solo querían el producto
 * —el filtro de control de inventario y el de productos vencidos— tiraban
 * la presentación al recibirla. Hacían trabajar al usuario de más para
 * después descartar el resultado.
 */
export type QueDevuelve = 'presentacion' | 'producto';

export interface OpcionesBuscador {
  /** `'producto'` hace que tocar la card alcance, sin abrirla. */
  devuelve?: QueDevuelve;
  /**
   * Acota el stock a una sucursal.
   *
   * ⚠️ Tiene **dos efectos**, igual que en el repo anterior: define de qué
   * sucursal es el stock, y si no viene **no se muestra stock en absoluto**.
   */
  sucursalId?: number;
  /**
   * Segunda sucursal, para mirar el producto **entre dos**: una
   * transferencia necesita el stock de origen y el de destino a la vez.
   */
  sucursalDestinoId?: number;
  etiquetaStock?: string;
  etiquetaStockDestino?: string;
  mostrarPrecio?: boolean;
  /** Acciones extra del menú `⋮`, además de las que el buscador ya pone. */
  acciones?: AccionProducto[];
  /** Texto del campo. Por defecto, «Código o descripción». */
  etiquetaCampo?: string;
}

export interface SeleccionProducto {
  producto: Producto;
  /** Ausente cuando `devuelve` es `'producto'`. */
  presentacion?: Presentacion;
  /** Solo en un código de balanza: kilos leídos del código. */
  peso?: number;
}

/** Acciones que el buscador maneja por su cuenta. */
export const ACCION_STOCK = 'stock';
