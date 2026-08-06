import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { Zona } from 'src/app/domains/zona/zona.model';

export enum InventarioEstado {
  ABIERTO = 'ABIERTO',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
}

/** El estado de la mercadería contada. Averiados y vencidos alimentan devoluciones. */
export enum InventarioProductoEstado {
  BUENO = 'BUENO',
  AVERIADO = 'AVERIADO',
  VENCIDO = 'VENCIDO',
}

/**
 * Cómo se elige qué contar.
 *
 * ⚠️ **No debería cambiarse a mitad de conteo.** Un `ZONA` cuenta todo lo de
 * esa zona; un `ABC`, solo los productos de esa clasificación. Cambiarlo con
 * ítems cargados deja un conteo cuyo alcance no coincide con su definición.
 */
export enum TipoInventario {
  ABC = 'ABC',
  ZONA = 'ZONA',
  PRODUCTO = 'PRODUCTO',
  CATEGORIA = 'CATEGORIA',
}

/**
 * El conteo concreto de una presentación.
 *
 * ⚠️ **Tres cantidades, tres propósitos.** `cantidad` es lo que dice el
 * sistema y `cantidadFisica` lo que se contó: **la diferencia entre las dos
 * es el resultado del inventario**. `cantidadAnterior` permite ver la
 * evolución entre tomas. Sobrescribir `cantidad` con `cantidadFisica` borra
 * justamente el resultado.
 *
 * ⚠️ **`verificado` y `revisado` son etapas distintas.** Primero alguien
 * cuenta, después un supervisor valida.
 */
export interface InventarioProductoItem {
  id?: number;
  /** Lo que dice el sistema. */
  cantidad?: number;
  /** Lo que se contó realmente. */
  cantidadFisica?: number;
  /** Lo que había en el inventario previo. */
  cantidadAnterior?: number;
  presentacion?: Presentacion;
  verificado?: boolean;
  revisado?: boolean;
  vencimiento?: string;
  estado?: InventarioProductoEstado;
  /**
   * ⚠️ **Un ítem con esto no se contó en esta toma**: se arrastró de una
   * anterior. Hay que filtrarlo antes de calcular la cobertura del conteo.
   */
  copiedFromItemId?: number;
  inventarioProducto?: { id?: number };
  creadoEn?: string;
}

/**
 * Un producto dentro de una **zona**.
 *
 * ⚠️ **El conteo es por presentación, no por producto.** Un producto con
 * «unidad» y «caja x12» genera ítems separados; sumarlos sin convertir da un
 * número sin sentido.
 */
export interface InventarioProducto {
  id?: number;
  producto?: Producto;
  zona?: Zona;
  concluido?: boolean;
  usuario?: Usuario;
  creadoEn?: string;
  inventarioProductoItemList?: InventarioProductoItem[];
}

/**
 * La cabecera.
 *
 * ⚠️ **`abierto` y `estado` son redundantes y nada garantiza que estén
 * sincronizados.** Usar `estado`, que es el que tiene los tres casos.
 */
export interface Inventario {
  id?: number;
  sucursal?: Sucursal;
  fechaInicio?: string;
  fechaFin?: string;
  abierto?: boolean;
  tipo?: TipoInventario;
  estado?: InventarioEstado;
  usuario?: Usuario;
  observacion?: string;
  inventarioProductoList?: InventarioProducto[];
}

export interface InventarioProductoItemInput {
  id?: number;
  inventarioProductoId?: number;
  zonaId?: number;
  presentacionId?: number;
  cantidad?: number;
  cantidadFisica?: number;
  cantidadAnterior?: number;
  vencimiento?: string;
  estado?: InventarioProductoEstado;
  verificado?: boolean;
  revisado?: boolean;
  usuarioId?: number;
}
