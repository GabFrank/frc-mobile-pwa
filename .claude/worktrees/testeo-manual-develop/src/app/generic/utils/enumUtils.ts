/** Convierte un enum de strings en una lista para poblar selectores. */
export function enumToArray<T extends Record<string, string>>(
  enumerado: T,
): { key: string; value: string }[] {
  return Object.entries(enumerado).map(([key, value]) => ({ key, value }));
}

/** Busca la clave de un enum a partir de su valor. */
export function getEnumValueByValue<T extends Record<string, string>>(
  enumerado: T,
  value: string,
): string | undefined {
  return Object.keys(enumerado).find((k) => enumerado[k] === value);
}
