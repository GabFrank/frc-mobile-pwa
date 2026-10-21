/**
 * Compras desde el celular: la factura del proveedor (KuDE) cargada al
 * pedido. Son los tipos `…Mobile` del central (`compras-mobile.graphqls`).
 *
 * ⚠️ **Cantidades y precios de la nota van en unidades base**, y los precios
 * **con IVA incluido**, como los cargan hoy los compradores en el desktop.
 * Todo monto y toda diferencia la calcula el central: acá solo se muestra.
 *
 * Las fechas llegan como texto `yyyy-MM-dd HH:mm`: pasan por `fechaLegible`.
 */

export interface CompraPedidoResumen {
  pedidoId: number;
  proveedorId?: number | null;
  proveedorNombre?: string | null;
  proveedorRuc?: string | null;
  fecha?: string | null;
  monedaSimbolo?: string | null;
  totalPedido?: number | null;
  cantidadItems?: number | null;
  itemsPendientes?: number | null;
  cantidadNotas?: number | null;
  /** PENDIENTE o EN_PROCESO */
  estadoEtapa?: string | null;
}

export interface CompraPedidoItem {
  pedidoItemId: number;
  productoId?: number | null;
  descripcion?: string | null;
  presentacionDescripcion?: string | null;
  presentacionCantidad?: number | null;
  cantidadSolicitada?: number | null;
  cantidadFacturada?: number | null;
  cantidadPendiente?: number | null;
  precioUnitario?: number | null;
  esBonificacion?: boolean | null;
  pendienteTexto?: string | null;
}

export interface CompraNota {
  id: number;
  numero?: number | null;
  numeroCompleto?: string | null;
  timbrado?: number | null;
  cdc?: string | null;
  electronica?: boolean | null;
  fecha?: string | null;
  estado?: string | null;
  estadoEtiqueta?: string | null;
  valor?: number | null;
  monedaSimbolo?: string | null;
  cantidadItems?: number | null;
  itemsSinDistribuir?: number | null;
  puedeEliminar?: boolean | null;
}

export interface CompraPedido {
  pedidoId: number;
  proveedorId?: number | null;
  proveedorNombre?: string | null;
  proveedorRuc?: string | null;
  fecha?: string | null;
  monedaDenominacion?: string | null;
  monedaSimbolo?: string | null;
  cotizacion?: number | null;
  estadoEtapa?: string | null;
  puedeCargarFacturas?: boolean | null;
  puedeFinalizar?: boolean | null;
  motivoNoOpera?: string | null;
  totalPedido?: number | null;
  totalFacturado?: number | null;
  itemsPendientes?: number | null;
  items: CompraPedidoItem[];
  notas: CompraNota[];
}

/** INFO, ADVERTENCIA o BLOQUEO (no deja confirmar). */
export type NivelAviso = 'INFO' | 'ADVERTENCIA' | 'BLOQUEO';

export interface AvisoFactura {
  /** IVA, PROVEEDOR, TOTAL, DUPLICADA, MONEDA, PRODUCTOS, CANCELADA, DISTRIBUCION, ETAPA */
  tipo: string;
  nivel: NivelAviso | string;
  mensaje: string;
}

export interface SugerenciaProducto {
  productoId: number;
  presentacionId: number;
  descripcion?: string | null;
  presentacionDescripcion?: string | null;
  factor?: number | null;
  codigo?: string | null;
  /** CODIGO_PARECIDO, DESCRIPCION, PROVEEDOR */
  tipo?: string | null;
  motivo?: string | null;
}

export type EstadoRenglon = 'OK' | 'DIFERENCIA' | 'FUERA_DE_PEDIDO' | 'SIN_PRODUCTO';

export interface RenglonFactura {
  id: number;
  orden?: number | null;
  codigoProveedor?: string | null;
  gtin?: string | null;
  gtinPaquete?: string | null;
  descripcion?: string | null;
  unidadMedida?: string | null;
  cantidad?: number | null;
  precioUnitario?: number | null;
  descuentoUnitario?: number | null;
  porcentajeDescuento?: number | null;
  total?: number | null;
  tasaIva?: number | null;
  ivaTexto?: string | null;
  lote?: string | null;
  vencimiento?: string | null;
  esBonificacion?: boolean | null;
  estado: EstadoRenglon | string;
  estadoEtiqueta?: string | null;
  tipoMatch?: string | null;
  tipoMatchEtiqueta?: string | null;
  productoId?: number | null;
  productoDescripcion?: string | null;
  presentacionId?: number | null;
  presentacionDescripcion?: string | null;
  factor?: number | null;
  pedidoItemId?: number | null;
  cantidadBase?: number | null;
  precioUnitarioBase?: number | null;
  pedidoCantidadPendiente?: number | null;
  pedidoPrecioUnitario?: number | null;
  diferencias: string[];
  avisosIva: string[];
  avisos: string[];
  requiereObservacion?: boolean | null;
  observacionFaltante?: boolean | null;
  observacion?: string | null;
  sugerencias: SugerenciaProducto[];
}

export interface FacturaProveedor {
  id: number;
  pedidoId?: number | null;
  cdc: string;
  tipoDocumento?: number | null;
  tipoDocumentoDescripcion?: string | null;
  emisorRuc?: string | null;
  emisorNombre?: string | null;
  receptorRuc?: string | null;
  receptorNombre?: string | null;
  timbrado?: number | null;
  establecimiento?: string | null;
  puntoExpedicion?: string | null;
  numero?: string | null;
  numeroCompleto?: string | null;
  fechaEmision?: string | null;
  condicion?: string | null;
  moneda?: string | null;
  monedaSimbolo?: string | null;
  cotizacion?: number | null;
  subtotalExenta?: number | null;
  subtotalIva5?: number | null;
  subtotalIva10?: number | null;
  totalDescuento?: number | null;
  totalGeneral?: number | null;
  totalIva5?: number | null;
  totalIva10?: number | null;
  totalIva?: number | null;
  totalNota?: number | null;
  consultadaEn?: string | null;
  proveedorId?: number | null;
  proveedorNombre?: string | null;
  renglonesOk?: number | null;
  renglonesConDiferencia?: number | null;
  renglonesFueraDePedido?: number | null;
  renglonesSinProducto?: number | null;
  renglonesSinObservacion?: number | null;
  puedeConfirmar?: boolean | null;
  motivoNoConfirma?: string | null;
  notaRecepcionId?: number | null;
  avisos: AvisoFactura[];
  renglones: RenglonFactura[];
  itemsNoFacturados: CompraPedidoItem[];
}

export interface ResumenFinalizarNotas {
  pedidoId: number;
  puedeFinalizar?: boolean | null;
  motivo?: string | null;
  cantidadNotas?: number | null;
  totalFacturado?: number | null;
  notasPendientes?: number | null;
  itemsSinFacturar: CompraPedidoItem[];
  avisos: string[];
}

export interface PedidosParaFactura {
  cdc?: string | null;
  tipoDocumentoDescripcion?: string | null;
  numeroCompleto?: string | null;
  proveedorRuc?: string | null;
  proveedorId?: number | null;
  proveedorNombre?: string | null;
  pedidos: CompraPedidoResumen[];
}
