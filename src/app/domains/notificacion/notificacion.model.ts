import { Usuario } from 'src/app/domains/personas/usuario.model';

/**
 * El evento. **No confundir con su entrega**: una notificación mandada a
 * cinco usuarios genera cinco `NotificacionDestinatario`, cada uno con su
 * propio `leida`.
 */
export interface Notificacion {
  id?: number;
  titulo?: string;
  mensaje?: string;
  /** String libre del backend, no un enum. Ver `descripcionDeTipo()`. */
  tipo?: string;
  /**
   * ⚠️ **Payload serializado, no un objeto.** No hay contrato tipado: si se
   * usa, hay que parsearlo defensivamente.
   */
  data?: string;
  estadoTablero?: string;
  fechaVerificacion?: string;
  creadoEn?: string;
  conteoComentarios?: number;
}

/** La entrega a **un** usuario. `leida` es de acá, no de la notificación. */
export interface NotificacionDestinatario {
  id?: number;
  notificacion?: Notificacion;
  leida?: boolean;
  fechaLeida?: string;
  fechaEntrega?: string;
  creadoEn?: string;
}

/**
 * Un comentario del hilo.
 *
 * ⚠️ **Los comentarios son un árbol, no una lista.** `comentarioPadre`
 * permite responder a uno puntual; al renderizar hay que agrupar por padre.
 */
export interface NotificacionComentario {
  id?: number;
  comentario?: string;
  mediaUrl?: string;
  creadoEn?: string;
  actualizadoEn?: string;
  usuario?: Usuario;
  comentarioPadre?: { id?: number };
}

export interface ConfiguracionNotificacion {
  tipo?: string;
  descripcion?: string;
  habilitado?: boolean;
  /**
   * ⚠️ **Hay notificaciones que el usuario no puede apagar.** Las de control
   * llegan sí o sí. La pantalla de preferencias las muestra **deshabilitadas,
   * no ocultas**: esconderlas haría creer que no existen.
   */
  esObligatorio?: boolean;
}

export interface FiltrosNotificacion {
  leidas?: boolean | null;
  page?: number;
  size?: number;
  estadoTablero?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

/**
 * Qué avisa cada tipo.
 *
 * ⚠️ **`tipo` es un string libre del backend.** Un tipo nuevo en el central
 * no aparece acá hasta que se agregue: por eso `descripcionDeTipo()` tiene
 * una salida para el desconocido en vez de dejar la fila vacía.
 *
 * Son **eventos de control, no marketing**: `VENTA_STOCK_CRITICO` y
 * `DIFERENCIA_MALETIN` señalan descuadres que alguien tiene que investigar,
 * y de ahí que el módulo tenga hilo de comentarios.
 */
export const DESCRIPCION_POR_TIPO: Readonly<Record<string, string>> = {
  AJUSTE_COSTO: 'Ajuste de costo de un producto',
  AJUSTE_STOCK: 'Ajuste manual de stock',
  CAMBIO_SUCURSAL_PRE_TRANSFERENCIA: 'Cambio de sucursal en una transferencia',
  COTIZACION_ACTUALIZADA: 'Cambio en la cotización de una moneda',
  DIFERENCIA_MALETIN: 'Diferencia detectada en maletín',
  FACTURA_ALTO_VALOR: 'Factura por un monto alto',
  GASTO: 'Gasto realizado en sucursal',
  INVENTARIO_INICIADO: 'Inicio de un inventario',
  NUEVO_DISPOSITIVO: 'Ingreso desde un dispositivo nuevo',
  PRECIO_ACTUALIZADO: 'Precio de venta actualizado',
  PRODUCTO_CREADO: 'Producto nuevo creado',
  RETIRO: 'Retiro realizado en sucursal',
  RRHH_ALERTA: 'Alerta del módulo de RRHH',
  RRHH_SOLICITUD: 'Solicitud de vale o vacación por aprobar',
  TRANSFERENCIA_INICIADA: 'Transferencia entre sucursales',
  VENTA_CREDITO_CLIENTE: 'Compra a crédito propia',
  VENTA_STOCK_CRITICO: 'Venta con producto en stock cero o negativo',
  VENTA_TRANSFERENCIA: 'Venta con pago por transferencia',
};

export function descripcionDeTipo(tipo: string | null | undefined): string {
  if (!tipo) {
    return 'Notificación';
  }
  return DESCRIPCION_POR_TIPO[tipo] ?? humanizar(tipo);
}

function humanizar(tipo: string): string {
  const limpio = tipo.replace(/_/g, ' ').toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}
