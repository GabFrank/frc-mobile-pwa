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

/**
 * `false` para el servidor, para `null` y para `undefined`.
 *
 * ⚠️ **Compara por valor, no por identidad.** GraphQL serializa `ID` como
 * **string**, así que la sucursal de la sesión llega como `"0"` y un
 * `id !== 0` la daba por buena: la primera versión de esta función dejaba
 * pasar exactamente el caso que existe para bloquear. Es el mismo problema
 * que ya está documentado en `frc-selector`, donde los ids se comparan con
 * `String(a) === String(b)` por esta razón.
 */
export function esSucursalReal(id: number | string | null | undefined): boolean {
  if (id == null || id === '') {
    return false;
  }
  return Number(id) !== SUCURSAL_SERVIDOR_ID;
}
