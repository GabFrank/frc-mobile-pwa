/**
 * Sucursales que **no son locales**.
 *
 * `empresarial.sucursal` tiene dos filas que no representan un punto de
 * venta y vienen `activo = true` como cualquier otra:
 *
 * | id | nombre |
 * |---|---|
 * | 0 | `SERVIDOR` |
 * | 999 | `COMPRAS` |
 *
 * Ninguna tiene depósito ni mostrador: preguntarles el stock de un producto,
 * o cargarles una devolución, no significa nada.
 *
 * ⚠️ **`frc-mobile` las descarta por nombre**, en seis pantallas distintas:
 * `s.nombre != 'SERVIDOR' && s.nombre != 'COMPRAS'`. Acá se descartan por id
 * **y** por nombre: el id es más barato y no depende de cómo esté escrito el
 * nombre, y el nombre cubre el caso de que los ids difieran entre bases.
 */
export const SUCURSAL_SERVIDOR_ID = 0;
export const SUCURSAL_COMPRAS_ID = 999;

const NOMBRES_NO_LOCALES = ['SERVIDOR', 'COMPRAS'];

/**
 * `false` para el servidor, para COMPRAS, para `null` y para `undefined`.
 *
 * ⚠️ **Compara por valor, no por identidad.** GraphQL serializa `ID` como
 * **string**, así que la sucursal de la sesión llega como `"0"` y un
 * `id !== 0` la daba por buena: la primera versión de esta función dejaba
 * pasar exactamente el caso que existe para bloquear.
 */
export function esSucursalReal(id: unknown): boolean {
  if (id == null || id === '') {
    return false;
  }
  const n = Number(id as string | number);
  if (!Number.isFinite(n)) {
    return false;
  }
  return n !== SUCURSAL_SERVIDOR_ID && n !== SUCURSAL_COMPRAS_ID;
}

/** Deja solo los locales de verdad. Usar en todo selector de sucursal. */
export function soloLocales<T extends { id?: number; nombre?: string }>(sucursales: T[]): T[] {
  return (sucursales ?? []).filter(
    (s) => esSucursalReal(s.id) && !NOMBRES_NO_LOCALES.includes(String(s.nombre ?? '').toUpperCase()),
  );
}
