/**
 * La sucursal `0` es el **servidor**, no un local.
 *
 * En `empresarial.sucursal` la fila con `id = 0` se llama `SERVIDOR` y está
 * `activo = true`, así que aparece en `sucursales()` como una más. No es un
 * punto de venta: no tiene depósito ni mostrador, y **preguntarle el stock de
 * un producto no significa nada**.
 *
 * Hay que descartarla explícitamente en todo lo que sea existencias,
 * movimientos o listados de locales. No alcanza con filtrar por `activo`.
 */
export const SUCURSAL_SERVIDOR_ID = 0;

/** `false` para el servidor, para `null` y para `undefined`. */
export function esSucursalReal(id: number | null | undefined): boolean {
  return id != null && id !== SUCURSAL_SERVIDOR_ID;
}
