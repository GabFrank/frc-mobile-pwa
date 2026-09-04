import { Usuario } from "../personas/usuario.model";
import { Codigo } from "./codigo.model";
import { Presentacion } from "./presentacion.model";

export class Producto {
  id?: number;
  idCentral?: number;
  descripcion?: string;
  descripcionFactura?: string;
  iva?: number;
  unidadPorCaja?: number;
  unidadPorCajaSecundaria?: number;
  balanza?: boolean;
  stock?: boolean;
  garantia?: boolean;
  tiempoGarantia?: number;
  ingrediente?: boolean;
  combo?: boolean;
  promocion?: boolean;
  vencimiento?: boolean;
  diasVencimiento?: number;
  /**
   * El producto lleva control de lote.
   *
   * ⚠️ **Cambia qué es un renglón de conteo.** Con `lote = true` un renglón es
   * un lote —y `cantidadFisica` es el saldo DE ESE LOTE, no la existencia del
   * producto—; sin él, el renglón es la presentación y nada más.
   */
  lote?: boolean;
  cambiable?: boolean;
  usuario?: Usuario;
  imagenPrincipal?: string;
  tipoConservacion?: string;
  // subfamilia?: Subfamilia;
  codigos?: [Codigo]
  // sucursales?: [ExistenciaCostoPorSucursal]
  // productoUltimasCompras?: [ExistenciaCostoPorSucursal]
  presentaciones?: Presentacion[];
  stockPorProducto?: number;
  codigoPrincipal?: string
  // costo: CostoPorProducto
  isEnvase?: boolean;
  envase?: Producto;
  activo?: boolean;
  propagado?: boolean;
  subfamilia?: { id?: number; descripcion?: string; familia?: { id?: number; descripcion?: string } };
}

/**
 * Lo que acepta `saveProducto` del central.
 *
 * ⚠️ **Se manda SIEMPRE completo.** `saveProducto` no parchea: mapea el input
 * a un `Producto` nuevo y lo guarda (`ProductoService.java:297-325`), así que
 * todo campo ausente se persiste en `null`. Armalo con
 * `construirProductoInput()`, nunca a mano.
 *
 * ⚠️ **`observacion` y `creadoEn` no están acá, cada uno por su propia razón:**
 * - `observacion` no existe en `input ProductoInput` del central — no hay
 *   forma de preservarlo desde ningún cliente.
 * - `creadoEn` SÍ está en el schema (`productos.graphqls:62`, tipo `String`),
 *   pero la entidad lo tiene como `LocalDateTime` sin `@PrePersist` ni
 *   `@CreationTimestamp` (`Producto.java:96-97`). El central mapea con
 *   `ModelMapper` en modo STRICT: un `String` no convertible tira excepción en
 *   el guardado ENTERO, no solo en ese campo. Mandarlo sería arriesgar el save
 *   completo para preservar una fecha — se decide no mandarlo nunca.
 *
 * `imagenes` sí está en esta clase, pero se manda siempre `null` a propósito:
 * el central lo reescribe a la ruta literal `/productos`, que es lo que ya
 * tienen las 8386 filas de `bodega` — no hay nada que preservar.
 *
 * Detalle completo, con los números de `bodega`, en `docs/TODO_TECNICO.md`
 * hallazgo #66.
 */
export class ProductoInput {
  id?: number | null;
  propagado?: boolean | null;
  descripcion?: string | null;
  descripcionFactura?: string | null;
  iva?: number | null;
  unidadPorCaja?: number | null;
  unidadPorCajaSecundaria?: number | null;
  balanza?: boolean | null;
  garantia?: boolean | null;
  tiempoGarantia?: number | null;
  ingrediente?: boolean | null;
  combo?: boolean | null;
  stock?: boolean | null;
  promocion?: boolean | null;
  vencimiento?: boolean | null;
  diasVencimiento?: number | null;
  cambiable?: boolean | null;
  usuarioId?: number | null;
  imagenes?: string | null;
  subfamiliaId?: number | null;
  tipoConservacion?: string | null;
  isEnvase?: boolean | null;
  envaseId?: number | null;
  activo?: boolean | null;
  lote?: boolean | null;
}
