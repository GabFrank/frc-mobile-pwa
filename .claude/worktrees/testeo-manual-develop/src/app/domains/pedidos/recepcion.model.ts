import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';

/**
 * Recepción de mercadería.
 *
 * ⚠️ **`RecepcionMercaderia` reemplaza a `NotaRecepcionAgrupada`.** La
 * entidad vieja sigue viva en el backend y en `frc-mobile`, pero acá no se
 * porta: modela peor el mismo hecho y arrastra once operaciones GraphQL que
 * nadie debería usar en código nuevo. Ver
 * `docs/modulos/operaciones-pedidos.md`.
 */
export enum RecepcionMercaderiaEstado {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

/** Cómo se llegó a la cantidad: leyendo el código o escribiéndola. */
export enum MetodoVerificacion {
  ESCANER = 'ESCANER',
  MANUAL = 'MANUAL',
}

/**
 * Por qué se rechaza mercadería.
 *
 * ⚠️ **`PRODUCTO_DANADO` va sin ñ.** Es el string que espera el backend.
 */
export enum MotivoRechazoFisico {
  PRODUCTO_DANADO = 'PRODUCTO_DANADO',
  PRODUCTO_VENCIDO = 'PRODUCTO_VENCIDO',
  CANTIDAD_INCORRECTA = 'CANTIDAD_INCORRECTA',
  PRODUCTO_DIFERENTE = 'PRODUCTO_DIFERENTE',
  EMBALAJE_DANADO = 'EMBALAJE_DANADO',
  PRODUCTO_FALTANTE = 'PRODUCTO_FALTANTE',
  OTRO = 'OTRO',
}

export const MOTIVO_RECHAZO_ETIQUETAS: Record<MotivoRechazoFisico, string> = {
  [MotivoRechazoFisico.PRODUCTO_DANADO]: 'Producto dañado',
  [MotivoRechazoFisico.PRODUCTO_VENCIDO]: 'Producto vencido',
  [MotivoRechazoFisico.CANTIDAD_INCORRECTA]: 'Cantidad incorrecta',
  [MotivoRechazoFisico.PRODUCTO_DIFERENTE]: 'Producto diferente',
  [MotivoRechazoFisico.EMBALAJE_DANADO]: 'Embalaje dañado',
  [MotivoRechazoFisico.PRODUCTO_FALTANTE]: 'Producto faltante',
  [MotivoRechazoFisico.OTRO]: 'Otro',
};

/**
 * El evento de recepción física: un proveedor descarga una o más notas en
 * una sucursal.
 *
 * `cantNotas` no viene del backend — se calcula del largo de `notas`.
 */
export interface RecepcionMercaderia {
  id?: number;
  proveedor?: { id?: number; persona?: { nombre?: string } };
  sucursalRecepcion?: Sucursal;
  fecha?: string;
  moneda?: Moneda;
  cotizacion?: number;
  estado?: RecepcionMercaderiaEstado;
  usuario?: Usuario;
  notas?: { id?: number }[];
}

/** Una nota —factura o remito— que el proveedor trae con la mercadería. */
export interface NotaRecepcion {
  id?: number;
  numero?: number;
  timbrado?: number;
  fecha?: string;
  tipoBoleta?: string;
  /** El backend lo llama así; `valor` es el nombre viejo del mismo dato. */
  valorTotal?: number;
  pagado?: boolean;
  estado?: string;
  cotizacion?: number;
  moneda?: Moneda;
  pedido?: { id?: number };
  compra?: { id?: number };
  documento?: { id?: number; descripcion?: string };
  usuario?: Usuario;
}

/**
 * Estados de nota que significan «acá no queda nada por recibir».
 *
 * Portado verbatim de `recepcion-notas.component.ts`: el backend ya filtra,
 * y esto es la segunda red.
 */
export const ESTADOS_NOTA_COMPLETA = ['RECEPCION_COMPLETA', 'CERRADA'];

/** Línea de una nota. Es el nivel al que el backend imputa un rechazo. */
export interface NotaRecepcionItem {
  id?: number;
  producto?: { id?: number; descripcion?: string };
  notaRecepcion?: { id?: number; numero?: number };
  cantidadEnNota?: number;
  cantidadRecibida?: number;
  cantidadRechazada?: number;
  cantidadPendiente?: number;
}

export enum PedidoRecepcionProductoEstado {
  PENDIENTE = 'PENDIENTE',
  RECIBIDO = 'RECIBIDO',
  RECIBIDO_PARCIALMENTE = 'RECIBIDO_PARCIALMENTE',
}

/**
 * Un producto a verificar, **agregado a través de todas las notas** de la
 * recepción.
 *
 * ⚠️ **Es por producto, no por línea de nota.** Si el mismo producto viene
 * en tres notas, acá hay una sola fila con la suma. Esa es la razón de que
 * el rechazo necesite decir explícitamente a qué nota se imputa: el reparto
 * de lo recibido lo hace el backend, pero a quién se le reclama la falta no
 * lo puede adivinar.
 *
 * ⚠️ **Todas las cantidades vienen en unidad base**, no en la presentación
 * que el operador ve. Convertir es responsabilidad de la pantalla.
 */
export interface PedidoRecepcionProductoDto {
  producto?: Producto;
  totalCantidadARecibirPorUnidad?: number;
  totalCantidadRecibidaPorUnidad?: number;
  totalCantidadRechazadaPorUnidad?: number;
  cantidadPendientePorUnidad?: number;
  /**
   * El backend decide que este producto se cuenta de a unidades sueltas y no
   * por presentación. Cuando es `true` la presentación se ignora.
   */
  mostrarEnUnidadBase?: boolean;
  presentacionInicialSugerida?: Presentacion;
  cantidadInicialPorPresentacion?: number;
  estado?: PedidoRecepcionProductoEstado;
}

/** El PDF de constancia, tal como lo devuelve el backend. */
export interface ConstanciaRecepcionPdf {
  pdfBase64?: string;
  nombreArchivo?: string;
  tamanioBytes?: number;
  fechaGeneracion?: string;
}
