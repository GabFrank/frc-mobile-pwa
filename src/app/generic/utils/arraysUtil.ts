/** Utilidades sobre arrays de entidades con `id`. */

interface ConId {
  id?: number;
}

export function orderByIdAsc<T extends ConId>(arr: readonly T[]): T[] {
  return [...arr].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export function orderByIdDesc<T extends ConId>(arr: readonly T[]): T[] {
  return [...arr].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}

/**
 * Reemplaza el elemento con el mismo `id`; si no existe, lo agrega.
 *
 * Devuelve un array nuevo: el original de `frc-mobile` mutaba el array de
 * entrada, lo que rompía la detección de cambios con `OnPush`.
 */
export function replaceObject<T extends ConId>(arr: readonly T[], objeto: T): T[] {
  const index = arr.findIndex((e) => e.id === objeto.id);
  if (index === -1) {
    return [...arr, objeto];
  }
  const copia = [...arr];
  copia[index] = objeto;
  return copia;
}
