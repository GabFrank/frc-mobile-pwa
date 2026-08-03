/**
 * Registro central de estados.
 *
 * El sistema tiene más de veinte máquinas de estado: `PedidoEstado` (12
 * valores), `EtapaTransferencia` (9), `EstadoDevolucion` (8),
 * `TransferenciaEstado` (8), `PdvCajaEstado` (6)…
 *
 * En `frc-mobile` cada pantalla elegía su color a mano, y por eso `#f44336`
 * aparecía hardcodeado 50 veces. Acá el mapeo vive en un solo lugar: un
 * estado se ve igual en toda la app, y sumar uno nuevo del backend es una
 * línea.
 *
 * ⚠️ Los valores son los strings que emite el backend. Varios están mal
 * escritos en el central (`CONLCUIDA`, `VERFICADO_*`) y **no se corrigen
 * acá**: el string tiene que coincidir exactamente con el que llega.
 */

/** Vocabulario cerrado de tonos. Ver styles/_tokens.scss. */
export type TonoEstado = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface EstadoVisual {
  etiqueta: string;
  tono: TonoEstado;
  /** Nombre del set de `frc-icono`. Opcional. */
  icono?: string;
}

/** Clave: `NombreDelEnum.VALOR`. */
export type ClaveEstado = string;

const REGISTRO: Record<ClaveEstado, EstadoVisual> = {
  // ─── Devoluciones ──────────────────────────────────────────────────────
  'EstadoDevolucion.PENDIENTE':  { etiqueta: 'Pendiente',  tono: 'warn',    icono: 'reloj' },
  'EstadoDevolucion.SEPARADO':   { etiqueta: 'Separado',   tono: 'warn',    icono: 'etiqueta' },
  'EstadoDevolucion.COLECTADO':  { etiqueta: 'Colectado',  tono: 'info',    icono: 'inventario' },
  'EstadoDevolucion.RETIRADO':   { etiqueta: 'Retirado',   tono: 'info',    icono: 'camion' },
  'EstadoDevolucion.CANJEADO':   { etiqueta: 'Canjeado',   tono: 'ok',      icono: 'intercambio' },
  'EstadoDevolucion.ACREDITADO': { etiqueta: 'Acreditado', tono: 'ok',      icono: 'checkCirculo' },
  'EstadoDevolucion.DESCARTADO': { etiqueta: 'Descartado', tono: 'danger',  icono: 'tirar' },
  'EstadoDevolucion.CANCELADA':  { etiqueta: 'Cancelada',  tono: 'danger',  icono: 'cancelar' },

  'TipoDevolucion.CON_PROVEEDOR': { etiqueta: 'Con proveedor', tono: 'info',    icono: 'sucursal' },
  'TipoDevolucion.SIN_PROVEEDOR': { etiqueta: 'Sin proveedor', tono: 'neutral', icono: 'documento' },

  // ─── Caja ──────────────────────────────────────────────────────────────
  'PdvCajaEstado.EN_PROCESO':                        { etiqueta: 'En proceso',              tono: 'warn',   icono: 'reloj' },
  'PdvCajaEstado.CONCLUIDO':                         { etiqueta: 'Concluido',               tono: 'ok',     icono: 'checkCirculo' },
  'PdvCajaEstado.NECESITA_VERIFICACION':             { etiqueta: 'Necesita verificación',   tono: 'danger', icono: 'error' },
  'PdvCajaEstado.EN_VERIFICACION':                   { etiqueta: 'En verificación',         tono: 'info',   icono: 'buscar' },
  'PdvCajaEstado.VERIFICADO_CONCLUIDO_SIN_PROBLEMA': { etiqueta: 'Verificado sin problema', tono: 'ok',     icono: 'verificado' },
  'PdvCajaEstado.VERIFICADO_CONCLUIDO_CON_PROBLEMA': { etiqueta: 'Verificado con problema', tono: 'danger', icono: 'error' },

  // ─── Transferencias ────────────────────────────────────────────────────
  'TransferenciaEstado.ABIERTA':                   { etiqueta: 'Abierta',       tono: 'neutral', icono: 'editar' },
  'TransferenciaEstado.EN_ORIGEN':                 { etiqueta: 'En origen',     tono: 'warn',    icono: 'sucursal' },
  'TransferenciaEstado.EN_TRANSITO':               { etiqueta: 'En tránsito',   tono: 'info',    icono: 'camion' },
  'TransferenciaEstado.EN_DESTINO':                { etiqueta: 'En destino',    tono: 'info',    icono: 'sucursal' },
  'TransferenciaEstado.FALTA_REVISION_EN_ORIGEN':  { etiqueta: 'Falta revisión en origen',  tono: 'danger', icono: 'error' },
  'TransferenciaEstado.FALTA_REVISION_EN_DESTINO': { etiqueta: 'Falta revisión en destino', tono: 'danger', icono: 'error' },
  // `CONLCUIDA` está mal escrito en el backend. No se corrige acá.
  'TransferenciaEstado.CONLCUIDA':                 { etiqueta: 'Concluida',     tono: 'ok',      icono: 'checkCirculo' },
  'TransferenciaEstado.CANCELADA':                 { etiqueta: 'Cancelada',     tono: 'danger',  icono: 'cancelar' },

  // ─── Recepción de mercaderías ──────────────────────────────────────────
  'RecepcionMercaderiaEstado.PENDIENTE':  { etiqueta: 'Pendiente',  tono: 'warn',    icono: 'reloj' },
  'RecepcionMercaderiaEstado.EN_PROCESO': { etiqueta: 'En proceso', tono: 'info',    icono: 'reloj' },
  'RecepcionMercaderiaEstado.FINALIZADA': { etiqueta: 'Finalizada', tono: 'ok',      icono: 'checkCirculo' },
  'RecepcionMercaderiaEstado.CANCELADA':  { etiqueta: 'Cancelada',  tono: 'danger',  icono: 'cancelar' },

  // ─── Inventario ────────────────────────────────────────────────────────
  'InventarioEstado.ABIERTO':   { etiqueta: 'Abierto',   tono: 'warn',   icono: 'editar' },
  'InventarioEstado.CONCLUIDO': { etiqueta: 'Concluido', tono: 'ok',     icono: 'checkCirculo' },
  'InventarioEstado.CANCELADO': { etiqueta: 'Cancelado', tono: 'danger', icono: 'cancelar' },

  'InventarioProductoEstado.BUENO':    { etiqueta: 'Bueno',    tono: 'ok',     icono: 'check' },
  'InventarioProductoEstado.AVERIADO': { etiqueta: 'Averiado', tono: 'danger', icono: 'alerta' },
  'InventarioProductoEstado.VENCIDO':  { etiqueta: 'Vencido',  tono: 'danger', icono: 'vencido' },

  // ─── Pagos ─────────────────────────────────────────────────────────────
  'SolicitudPagoEstado.PENDIENTE': { etiqueta: 'Pendiente', tono: 'warn',   icono: 'reloj' },
  'SolicitudPagoEstado.PARCIAL':   { etiqueta: 'Parcial',   tono: 'info',   icono: 'reloj' },
  'SolicitudPagoEstado.CONCLUIDO': { etiqueta: 'Concluido', tono: 'ok',     icono: 'checkCirculo' },
  'SolicitudPagoEstado.CANCELADO': { etiqueta: 'Cancelado', tono: 'danger', icono: 'cancelar' },

  'PagoEstado.ABIERTO':   { etiqueta: 'Abierto',   tono: 'neutral', icono: 'editar' },
  'PagoEstado.PENDIENTE': { etiqueta: 'Pendiente', tono: 'warn',    icono: 'reloj' },
  'PagoEstado.PARCIAL':   { etiqueta: 'Parcial',   tono: 'info',    icono: 'reloj' },
  'PagoEstado.CONCLUIDO': { etiqueta: 'Concluido', tono: 'ok',      icono: 'checkCirculo' },
  'PagoEstado.CANCELADO': { etiqueta: 'Cancelado', tono: 'danger',  icono: 'cancelar' },

  // ─── Venta con tarjeta ─────────────────────────────────────────────────
  'VentaTarjetaEstado.PENDIENTE':  { etiqueta: 'Pendiente',  tono: 'warn', icono: 'reloj' },
  'VentaTarjetaEstado.COMPLETADO': { etiqueta: 'Completado', tono: 'ok',   icono: 'checkCirculo' },

  // ─── Marcación ─────────────────────────────────────────────────────────
  'TipoMarcacion.ENTRADA': { etiqueta: 'Entrada', tono: 'ok',      icono: 'entrada' },
  'TipoMarcacion.SALIDA':  { etiqueta: 'Salida',  tono: 'neutral', icono: 'salida' },
};

/** Cómo se muestra un estado desconocido: visible, pero sin inventar color. */
const DESCONOCIDO: EstadoVisual = { etiqueta: '—', tono: 'neutral' };

/**
 * Resuelve el aspecto de un estado.
 *
 * Si el backend agrega un valor que no está registrado, se muestra el valor
 * crudo en tono neutro en vez de romper la pantalla — pero conviene sumarlo
 * a este archivo.
 */
export function resolverEstado(
  enumerado: string,
  valor: string | null | undefined,
): EstadoVisual {
  if (!valor) {
    return DESCONOCIDO;
  }
  return REGISTRO[`${enumerado}.${valor}`] ?? { etiqueta: humanizar(valor), tono: 'neutral' };
}

/** `VERIFICADO_CONCLUIDO` → `Verificado concluido`. */
function humanizar(valor: string): string {
  const limpio = valor.replace(/_/g, ' ').toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Solo para la galería y los tests. */
export function estadosRegistrados(): ClaveEstado[] {
  return Object.keys(REGISTRO);
}
