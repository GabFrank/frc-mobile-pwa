import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
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
 * ⚠️ **Los nombres están al revés de lo que dicen.** `cantidad` es **lo que
 * se contó** y `cantidadFisica` **lo que dice el sistema**. No es una
 * interpretación: `InventarioGraphQL.finalizarInventarioEnSucursal()` suma
 * `ipi.getCantidad() * presentacion.getCantidad()` y le resta el saldo de
 * `movimiento_stock`, así que `cantidad` es el conteo para el central.
 * `frc-mobile` coincide: su diálogo de conteo escribe `cantidad` y llena
 * `cantidadFisica`/`cantidadAnterior` con el stock del momento.
 *
 * La diferencia entre las dos **es el resultado del inventario**;
 * sobrescribir una con la otra lo borra.
 *
 * Esta app las tuvo al derecho por un tiempo, y la consecuencia era muda:
 * lo contado desde el teléfono viajaba en `cantidadFisica`, que el central
 * no mira al finalizar, así que el ajuste de stock salía de un número que
 * nadie había contado.
 *
 * ⚠️ **`verificado` y `revisado` no son dos etapas sino dos resultados del
 * mismo paso.** Los escribe quien cuenta: coincide con el sistema →
 * `verificado`; hubo que corregir → `revisado`. Nunca las dos.
 */
export interface InventarioProductoItem {
  id?: number;
  /** Lo que se contó realmente. */
  cantidad?: number;
  /** Lo que dice el sistema. */
  cantidadFisica?: number;
  /** El stock del sistema al momento de sumar el ítem a la toma. */
  cantidadAnterior?: number;
  presentacion?: Presentacion;
  verificado?: boolean;
  revisado?: boolean;
  vencimiento?: string;
  estado?: InventarioProductoEstado;
  inventarioProducto?: { id?: number };
  creadoEn?: string;
  // ⚠️ **No hay `copiedFromItemId`.** En `frc-mobile` es una marca de memoria
  // del diálogo de edición —se pone al copiar el conteo de una toma anterior
  // y `toInput()` nunca la manda—, así que el central no tiene ni columna ni
  // campo: pedirlo hace que rechace la consulta entera por validación. Si
  // alguna vez hace falta distinguir lo arrastrado, primero se persiste allá.
}

/**
 * Lo que se cuenta en **una zona**.
 *
 * ⚠️ **El nombre engaña: no es un producto.** El central le sacó
 * `producto_id` a la tabla (migración `V61.1`) y la unicidad quedó en
 * `(inventario_id, zona_id)`: un renglón es una zona con todos sus ítems
 * adentro. El producto de cada ítem sale de `presentacion.producto`.
 *
 * ⚠️ **El conteo es por presentación, no por producto.** Un producto con
 * «unidad» y «caja x12» genera ítems separados; sumarlos sin convertir da un
 * número sin sentido.
 */
export interface InventarioProducto {
  id?: number;
  zona?: Zona;
  concluido?: boolean;
  usuario?: Usuario;
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

/**
 * El alta o la edición de una cabecera.
 *
 * ⚠️ **`fechaInicio` y `fechaFin` van como texto**, no como `Date`: el
 * `InventarioInput` del central las declara `String` y las parsea con
 * `stringToDate`. Al abrir una toma no se mandan — la pone el central.
 */
export interface InventarioInput {
  id?: number;
  sucursalId?: number;
  fechaInicio?: string;
  fechaFin?: string;
  abierto?: boolean;
  tipo?: TipoInventario;
  estado?: InventarioEstado;
  observacion?: string;
  usuarioId?: number;
}

/**
 * Una zona dentro de una toma.
 *
 * ⚠️ **No lleva `productoId` ni `creadoEn`.** El `toInput()` de `frc-mobile`
 * los manda y el `InventarioProductoInput` del central no los tiene: la
 * validación de GraphQL rechaza la mutation entera antes de llegar al
 * resolver. Es el mismo campo fantasma que ya tumbó consultas en este módulo
 * — el central le sacó `producto_id` a la tabla en la migración `V61.1`.
 */
export interface InventarioProductoInput {
  id?: number;
  inventarioId?: number;
  zonaId?: number;
  concluido?: boolean;
  usuarioId?: number;
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
