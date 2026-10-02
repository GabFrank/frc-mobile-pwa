import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import {
  PedidoRecepcionProductoDto,
  PedidoRecepcionProductoEstado,
  RecepcionMercaderiaEstado,
} from 'src/app/domains/pedidos/recepcion.model';

/**
 * Aritmética de la verificación de mercadería.
 *
 * ⚠️ **El cliente no reparte cantidades entre notas.** Cuando el mismo
 * producto viene en varias notas de la misma recepción, se manda el total
 * verificado y **el backend lo distribuye**. Acá solo se convierte entre
 * unidad base y presentación, y se valida que los totales cierren.
 *
 * ⚠️ **Todo lo que viene del backend está en unidad base.** La pantalla
 * muestra en presentación —«3 cajas»— y el backend habla de unidades —«36».
 * Mezclar las dos escalas es el error que este archivo existe para evitar:
 * las funciones dicen en su nombre en qué escala trabajan.
 */

/** Presentación sintética para los productos que se cuentan de a unidades. */
export const PRESENTACION_UNIDAD_BASE: Presentacion = {
  id: undefined,
  descripcion: 'UNIDAD BASE',
  cantidad: 1,
} as Presentacion;

/**
 * Cuántas unidades base entran en una presentación.
 *
 * Cae en 1 —no en 0— si la presentación no trae cantidad: dividir por cero
 * daría `Infinity` en pantalla, y multiplicar por cero borraría lo contado.
 */
export function escalaDe(
  presentacion: Presentacion | null | undefined,
  enUnidadBase = false,
): number {
  if (enUnidadBase) {
    return 1;
  }
  const cantidad = presentacion?.cantidad;
  return cantidad != null && cantidad > 0 ? cantidad : 1;
}

/** Presentación → unidad base. */
export function aUnidadBase(cantidad: number, escala: number): number {
  return (cantidad || 0) * escala;
}

/** Unidad base → presentación. */
export function aPresentacion(unidades: number, escala: number): number {
  return (unidades || 0) / (escala || 1);
}

/**
 * Lo que todavía falta recibir de un producto, en unidad base.
 *
 * Se prefiere `cantidadPendientePorUnidad` porque lo calcula el backend con
 * las distribuciones a la vista; la resta es el plan B cuando no viene.
 */
export function pendienteDe(item: PedidoRecepcionProductoDto): number {
  if (item?.cantidadPendientePorUnidad != null) {
    return item.cantidadPendientePorUnidad;
  }
  return (
    (item?.totalCantidadARecibirPorUnidad ?? 0) -
    (item?.totalCantidadRecibidaPorUnidad ?? 0) -
    (item?.totalCantidadRechazadaPorUnidad ?? 0)
  );
}

/**
 * `true` si al producto le falta mercadería por verificar.
 *
 * ⚠️ Usa la resta y no `cantidadPendientePorUnidad`: es la definición que
 * `frc-mobile` aplica antes de finalizar, y de ella depende qué productos se
 * marcan como rechazados al cerrar. Cambiar la fuente cambiaría qué se
 * rechaza.
 */
export function tienePendiente(item: PedidoRecepcionProductoDto): boolean {
  const aRecibir = item?.totalCantidadARecibirPorUnidad ?? 0;
  const recibido = item?.totalCantidadRecibidaPorUnidad ?? 0;
  const rechazado = item?.totalCantidadRechazadaPorUnidad ?? 0;
  return aRecibir - recibido - rechazado > 0;
}

/** Los productos que quedarían sin verificar si se finalizara ahora. */
export function itemsPendientes(
  items: PedidoRecepcionProductoDto[],
): PedidoRecepcionProductoDto[] {
  return (items ?? []).filter(tienePendiente);
}

/**
 * Si se puede revertir la verificación de un producto.
 *
 * Dos caminos, y el segundo no es redundante: un producto puede tener
 * cantidades cargadas y seguir en `PENDIENTE` —se verificó de menos—, y esa
 * carga también tiene que poder deshacerse mientras la recepción esté en
 * proceso.
 */
export function puedeDeshacer(
  item: PedidoRecepcionProductoDto,
  estadoRecepcion: RecepcionMercaderiaEstado | undefined,
): boolean {
  if (
    item?.estado === PedidoRecepcionProductoEstado.RECIBIDO ||
    item?.estado === PedidoRecepcionProductoEstado.RECIBIDO_PARCIALMENTE
  ) {
    return true;
  }
  const hayCargado =
    (item?.totalCantidadRecibidaPorUnidad ?? 0) > 0 ||
    (item?.totalCantidadRechazadaPorUnidad ?? 0) > 0;
  return estadoRecepcion === RecepcionMercaderiaEstado.EN_PROCESO && hayCargado;
}

/** Lo que se lleva cargado en el diálogo, en unidad base. */
export interface CargaVerificacion {
  recibida: number;
  rechazada: number;
}

/**
 * Valida una línea antes de sumarla a la carga.
 *
 * Devuelve el mensaje de error, o `null` si la línea entra.
 */
export function validarLinea(
  cantidadEnPresentacion: number,
  escala: number,
  restante: number,
): string | null {
  if (!cantidadEnPresentacion || cantidadEnPresentacion <= 0) {
    return 'Ingresá una cantidad mayor a cero.';
  }
  if (!escala || escala <= 0) {
    return 'Elegí una presentación.';
  }
  if (aUnidadBase(cantidadEnPresentacion, escala) > restante) {
    return 'La suma de recibido y rechazado no puede superar lo que falta recibir.';
  }
  return null;
}

/**
 * Valida la carga completa antes de mandarla.
 *
 * ⚠️ **Recibir de menos sin rechazar está prohibido, y no es una formalidad.**
 * La diferencia entre lo que dice la nota y lo que bajó del camión tiene que
 * quedar imputada a una nota y con un motivo: es lo que sostiene el reclamo
 * al proveedor. Si se aceptara «recibí 8 de 10» sin más, la falta
 * desaparecería del sistema.
 */
export function validarCarga(
  carga: CargaVerificacion,
  pendiente: number,
): string | null {
  const recibida = carga?.recibida ?? 0;
  const rechazada = carga?.rechazada ?? 0;

  if (recibida <= 0 && rechazada <= 0) {
    return 'Cargá al menos una cantidad recibida o rechazada.';
  }
  if (recibida < pendiente && rechazada === 0) {
    return (
      'Lo recibido (' +
      recibida +
      ') es menor a lo pendiente (' +
      pendiente +
      '). Agregá un rechazo por la diferencia.'
    );
  }
  if (recibida + rechazada > pendiente) {
    return 'La suma de recibido y rechazado no puede superar lo pendiente.';
  }
  return null;
}

/** Lo que se muestra arriba del diálogo, ya en presentación. */
export interface ResumenVerificacion {
  aRecibir: number;
  recibido: number;
  rechazado: number;
  falta: number;
  /** Se recibió todo lo pendiente y no hubo rechazos. */
  completo: boolean;
}

/**
 * Resume el estado del producto sumando lo que se lleva cargado.
 *
 * `recibido` incluye lo verificado en sesiones anteriores; `rechazado`, en
 * cambio, es solo lo de esta carga: es lo que se está por imputar, y sumarle
 * rechazos viejos haría creer que se están rechazando de nuevo.
 */
export function resumirVerificacion(
  item: PedidoRecepcionProductoDto,
  escala: number,
  carga: CargaVerificacion,
): ResumenVerificacion {
  const pendiente = pendienteDe(item);
  const recibidaPrevia = item?.totalCantidadRecibidaPorUnidad ?? 0;
  const nuevaRecibida = carga?.recibida ?? 0;
  const nuevaRechazada = carga?.rechazada ?? 0;
  const falta = pendiente - nuevaRecibida - nuevaRechazada;

  return {
    aRecibir: aPresentacion(item?.totalCantidadARecibirPorUnidad ?? 0, escala),
    recibido: aPresentacion(recibidaPrevia + nuevaRecibida, escala),
    rechazado: aPresentacion(nuevaRechazada, escala),
    falta: aPresentacion(falta, escala),
    completo: nuevaRechazada === 0 && nuevaRecibida > 0 && falta === 0,
  };
}

/** Cuánto queda por cargar en esta sesión, en unidad base. */
export function restanteDeCarga(
  item: PedidoRecepcionProductoDto,
  carga: CargaVerificacion,
): number {
  return pendienteDe(item) - (carga?.recibida ?? 0) - (carga?.rechazada ?? 0);
}
