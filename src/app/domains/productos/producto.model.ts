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
}

export class ProductoInput {
  id?: number;
  descripcion?: string;
  descripcionFactura?: string;
  iva?: number;
  unidadPorCaja?: number;
  unidadPorCajaSecundaria?: number;
  balanza?: boolean;
  stock?: boolean;
  garantia?: boolean;
  tiempoGarantia?: boolean;
  cambiable?: boolean;
  ingredientes?: boolean;
  combo?: boolean;
  promocion?: boolean;
  vencimiento?: boolean;
  diasVencimiento?: number;
  usuarioId?: number;
  imagenes?: string;
  tipoConservacion?: string;
  subfamiliaId?: number;
  isEnvase?: boolean;
  envaseId?: number;
}
