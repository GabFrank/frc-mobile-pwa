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

  // ─── RRHH ──────────────────────────────────────────────────────────────
  'LiquidacionSueldoEstado.BORRADOR': { etiqueta: 'Borrador', tono: 'neutral', icono: 'documento' },
  'LiquidacionSueldoEstado.APROBADA': { etiqueta: 'Aprobada', tono: 'info',    icono: 'check' },
  'LiquidacionSueldoEstado.PAGADA':   { etiqueta: 'Pagada',   tono: 'ok',      icono: 'checkCirculo' },
  'LiquidacionSueldoEstado.ANULADA':  { etiqueta: 'Anulada',  tono: 'danger',  icono: 'cancelar' },

  // Un vale DESCONTADO ya se cobró en la liquidación: es el final feliz del
  // ciclo, no un problema. CONFIRMADO es "aprobado pero todavía no cobrado".
  'ValeEstado.SOLICITADO': { etiqueta: 'Solicitado', tono: 'warn',    icono: 'reloj' },
  'ValeEstado.CONFIRMADO': { etiqueta: 'Confirmado', tono: 'info',    icono: 'check' },
  'ValeEstado.DESCONTADO': { etiqueta: 'Descontado', tono: 'ok',      icono: 'checkCirculo' },
  'ValeEstado.ANULADO':    { etiqueta: 'Anulado',    tono: 'danger',  icono: 'cancelar' },

  'VacacionPeriodoEstado.SOLICITADA': { etiqueta: 'Solicitada', tono: 'warn',    icono: 'reloj' },
  'VacacionPeriodoEstado.PROGRAMADA': { etiqueta: 'Programada', tono: 'info',    icono: 'check' },
  'VacacionPeriodoEstado.EN_CURSO':   { etiqueta: 'En curso',   tono: 'info',    icono: 'reloj' },
  'VacacionPeriodoEstado.GOZADA':     { etiqueta: 'Gozada',     tono: 'ok',      icono: 'checkCirculo' },
  'VacacionPeriodoEstado.CANCELADA':  { etiqueta: 'Cancelada',  tono: 'danger',  icono: 'cancelar' },

  // AUSENTE es rojo y no naranja a propósito: un día sin marcar tiene
  // consecuencias en la liquidación, no es un pendiente administrativo.
  'EstadoJornada.NORMAL':     { etiqueta: 'Normal',     tono: 'ok',      icono: 'checkCirculo' },
  'EstadoJornada.INCOMPLETO': { etiqueta: 'Incompleto', tono: 'warn',    icono: 'alerta' },
  'EstadoJornada.AUSENTE':    { etiqueta: 'Ausente',    tono: 'danger',  icono: 'error' },

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
  // PENDIENTE = cobrada pero sin cupón registrado; COMPLETADO = conciliada.
  'VentaTarjetaEstado.PENDIENTE':  { etiqueta: 'Sin registrar', tono: 'warn', icono: 'reloj' },
  'VentaTarjetaEstado.COMPLETADO': { etiqueta: 'Registrado',    tono: 'ok',   icono: 'checkCirculo' },

  // ─── Compras a crédito por convenio ────────────────────────────────────
  // ABIERTO es neutro y no naranja: para el funcionario un convenio abierto
  // es lo normal —recién se salda con la liquidación del mes—, no algo
  // pendiente de su parte. EN_MORA sí es su problema.
  'EstadoVentaCredito.ABIERTO':     { etiqueta: 'Abierto',     tono: 'neutral', icono: 'documento' },
  'EstadoVentaCredito.FINALIZADO':  { etiqueta: 'Finalizado',  tono: 'ok',      icono: 'checkCirculo' },
  'EstadoVentaCredito.EN_MORA':     { etiqueta: 'En mora',     tono: 'danger',  icono: 'alerta' },
  'EstadoVentaCredito.INCOBRABLE':  { etiqueta: 'Incobrable',  tono: 'danger',  icono: 'error' },
  'EstadoVentaCredito.CANCELADO':   { etiqueta: 'Cancelado',   tono: 'danger',  icono: 'cancelar' },

  // ─── Marcación ─────────────────────────────────────────────────────────
  'TipoMarcacion.ENTRADA': { etiqueta: 'Entrada', tono: 'ok',      icono: 'entrada' },
  'TipoMarcacion.SALIDA':  { etiqueta: 'Salida',  tono: 'neutral', icono: 'salida' },

  // ─── Recepción de mercadería ───────────────────────────────────────────
  // Los estados de la recepción ya están arriba, con los de operaciones.
  //
  // RECIBIDO_PARCIALMENTE es naranja y no verde: falta mercadería que, si se
  // finaliza así, se rechaza. Es trabajo pendiente, no un final.
  'PedidoRecepcionProductoEstado.PENDIENTE':             { etiqueta: 'Pendiente', tono: 'neutral', icono: 'reloj' },
  'PedidoRecepcionProductoEstado.RECIBIDO':              { etiqueta: 'Recibido',  tono: 'ok',      icono: 'checkCirculo' },
  'PedidoRecepcionProductoEstado.RECIBIDO_PARCIALMENTE': { etiqueta: 'Parcial',   tono: 'warn',    icono: 'alerta' },
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
