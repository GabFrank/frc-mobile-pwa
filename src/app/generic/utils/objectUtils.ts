/** Serialización simple. */

export function objToJson(obj: unknown): string {
  return JSON.stringify(obj);
}

/** Devuelve `null` si el JSON es inválido, en vez de lanzar. */
export function jsonToObj<T = unknown>(json: string | null | undefined): T | null {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
