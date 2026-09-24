/**
 * Qué sucursales pueden participar de una operación.
 *
 * **El campo que lo define es `deposito`.** Una sucursal con depósito mueve
 * stock y puede recibir devoluciones, inventarios y transferencias; una sin
 * depósito es **virtual** y no participa de nada de eso.
 *
 * En la base son exactamente dos las virtuales, y las dos vienen
 * `activo = true`:
 *
 * | id | nombre | deposito |
 * |---|---|---|
 * | 0 | `SERVIDOR` | `false` |
 * | 999 | `COMPRAS` | `false` |
 *
 * Las otras 27 tienen `deposito = true`.
 *
 * ⚠️ **`frc-mobile` las descarta por nombre** —`s.nombre != 'SERVIDOR' &&
 * s.nombre != 'COMPRAS'`— en seis pantallas. Filtrar por `deposito` dice lo
 * mismo pero por la razón correcta: una sucursal virtual nueva quedaría
 * afuera sola, sin tocar seis archivos.
 *
 * ⚠️ **`tipo_local` parece servir y no sirve.** `SERVIDOR` y `COMPRAS` son
 * `VENTA`, y las 27 reales son `DEPOSITO`: está al revés de lo que sugiere el
 * nombre. **No usarlo** para esto.
 *
 * ⚠️ **`manejo_stock` es `true` en las 29.** Hoy no discrimina nada.
 */

/** Lo mínimo para decidir. */
export interface SucursalOperable {
  id?: number;
  nombre?: string;
  deposito?: boolean;
  activo?: boolean;
}

/**
 * `true` si la sucursal puede participar de operaciones de stock.
 *
 * Pide el objeto, no el id: la decisión es del dato, no del número. Para
 * decidir con un id suelto está {@link esSucursalOperableId}, que necesita la
 * lista para resolverlo.
 */
export function esSucursalOperable(sucursal: SucursalOperable | null | undefined): boolean {
  if (!sucursal) {
    return false;
  }
  // `activo` es otra dimensión: hay 8 sucursales con depósito que están
  // cerradas. Una operación nueva no puede ir a una sucursal cerrada, pero
  // sus datos históricos sí se consultan.
  return sucursal.deposito === true && sucursal.activo !== false;
}

/**
 * Deja solo las sucursales que pueden operar. Usar en todo selector.
 *
 * Las que no tienen depósito quedan afuera **y** las cerradas también.
 */
export function soloOperables<T extends SucursalOperable>(sucursales: T[]): T[] {
  return (sucursales ?? []).filter(esSucursalOperable);
}

/** Resuelve un id contra la lista. `false` si no está o no es operable. */
export function esSucursalOperableId(
  id: unknown,
  sucursales: SucursalOperable[],
): boolean {
  if (id == null || id === '') {
    return false;
  }
  // Comparación por valor: GraphQL serializa `ID` como string, así que la
  // sucursal de la sesión llega como `"0"` y un `===` contra un número
  // dejaría pasar justo el caso que hay que bloquear.
  const encontrada = (sucursales ?? []).find((s) => String(s.id) === String(id));
  return esSucursalOperable(encontrada);
}
