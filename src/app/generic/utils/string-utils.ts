/** Utilidades de texto. */

/** Escapa los caracteres con significado en una expresión regular. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Búsqueda difusa: `"cocacola"` matchea `"Coca Cola 2L"`.
 *
 * Corrige el bug de `frc-mobile` (TODO_TECNICO #12): allá la entrada del
 * usuario se insertaba cruda en el `RegExp`, así que un paréntesis o un
 * corchete lanzaba excepción.
 */
export function comparatorLike(patron: string, texto: string): boolean {
  if (!patron) {
    return true;
  }
  const cuerpo = [...patron]
    .filter((c) => c !== ' ')
    .map((c) => escaparRegex(c))
    .join('.*');
  return new RegExp(cuerpo, 'i').test(texto ?? '');
}

/**
 * UUID v4.
 *
 * Usa `crypto.randomUUID()` cuando está disponible (todo navegador en
 * contexto seguro). No es fuente de aleatoriedad para fines de seguridad.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
