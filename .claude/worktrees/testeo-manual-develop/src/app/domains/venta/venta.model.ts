import { PdvCaja } from "src/app/domains/caja/caja.model"
import { Cobro } from "../cobro/cobro.model"
import { FormaPago } from "../forma-pago/forma-pago.model"
import { Usuario } from "../personas/usuario.model"
import { PrecioPorSucursal } from "../productos/precio-por-sucursal.model"
import { Presentacion } from "../productos/presentacion.model"
import { Producto } from "../productos/producto.model"

export class Venta {
  id?: number;
  caja?: PdvCaja;
  formaPago?: FormaPago;
  estado?: VentaEstado;
  creadoEn?: Date;
  usuario?: Usuario;
  ventaItemList?: VentaItem[];
  valorDescuento?: number;
  valorTotal?: number;
  totalGs?: number;
  totalRs?: number;
  totalDs?: number;
  cobro?: Cobro;
  sucursalId?: number;
}

export class VentaItem {
  id?: number;
  venta?: Venta;
  producto?: Producto;
  presentacion?: Presentacion;
  cantidad?: number;
  precioCosto?: number;
  precio?: number;
  precioVenta?: PrecioPorSucursal;
  valorDescuento?: number;
  creadoEn?: Date;
  usuario?: Usuario;
  valorTotal?: number;
  sucursalId?: number;
}

export enum VentaEstado {
  ABIERTA, CANCELADA, CONCLUIDA, EN_VERIFICACION
}
