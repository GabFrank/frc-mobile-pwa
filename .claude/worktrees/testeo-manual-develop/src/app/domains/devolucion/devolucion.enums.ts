/**
 * Máquina de estados de una devolución. **Es la regla central del módulo.**
 *
 * ```
 * PENDIENTE ──> SEPARADO ──> COLECTADO ──> RETIRADO ──┬──> CANJEADO
 *      │                                              └──> ACREDITADO
 *      ├──────────────> DESCARTADO
 *      └──────────────> CANCELADA
 * ```
 *
 * ⚠️ **No repliques la máquina en el cliente.** Qué transición se permite lo
 * decide el backend: la UI llama `avanzarEstadoDevolucion` y muestra lo que
 * conteste. Duplicar las reglas acá garantiza que en algún momento difieran.
 */
export enum EstadoDevolucion {
  PENDIENTE = 'PENDIENTE',
  SEPARADO = 'SEPARADO',
  COLECTADO = 'COLECTADO',
  RETIRADO = 'RETIRADO',
  CANJEADO = 'CANJEADO',
  ACREDITADO = 'ACREDITADO',
  DESCARTADO = 'DESCARTADO',
  CANCELADA = 'CANCELADA',
}

/**
 * ⚠️ **El tipo determina el final posible.** Una `SIN_PROVEEDOR` —rotura
 * interna, vencido sin acuerdo— solo puede terminar en `DESCARTADO`.
 * `CANJEADO` y `ACREDITADO` exigen `CON_PROVEEDOR`.
 */
export enum TipoDevolucion {
  SIN_PROVEEDOR = 'SIN_PROVEEDOR',
  CON_PROVEEDOR = 'CON_PROVEEDOR',
}
