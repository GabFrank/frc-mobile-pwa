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
 * ⚠️ **`observacion` y `creadoEn` no están acá y no es un olvido**: el schema
 * del central no los acepta, así que cada guardado los deja en `null` y no hay
 * forma de evitarlo desde el cliente. Ya le pasa al escritorio, que llama la
 * misma mutation. Anotado en `docs/TODO_TECNICO.md`.
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
