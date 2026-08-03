/**
 * Utilidades para interpretar escaneos de código de barras / QR.
 * Soporta EAN/UPC, prefijo pesable (20), Code128 alfanumérico e internos cortos.
 */

const NUMERIC_BARCODE = /^\d{6,14}$/;
const NUMERIC_PREFIX = /^(\d{6,14})/;
const ALPHANUM_TOKEN = /^([A-Z0-9][A-Z0-9\-._]{3,31})/i;
const SINGLE_TOKEN_CODE = /^[A-Z0-9\-._]{4,32}$/i;
const GS1_GTIN = /\(01\)(\d{14})/;

export function normalizarCodigo(codigo: string): string {
  return codigo?.trim().toUpperCase() ?? '';
}

function agregarCodigo(lista: string[], codigo: string): void {
  const normalizado = normalizarCodigo(codigo);
  if (normalizado && !lista.includes(normalizado)) {
    lista.push(normalizado);
  }
}

/**
 * Devuelve candidatos de código en orden de prioridad para productoPorCodigo.
 */
export function codigosParaBuscar(text: string): string[] {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return [];
  }

  const candidatos: string[] = [];

  if (esCodigoPesable(trimmed)) {
    agregarCodigo(candidatos, trimmed);
  }

  const numericMatch = trimmed.match(NUMERIC_PREFIX);
  if (numericMatch) {
    agregarCodigo(candidatos, numericMatch[1]);
  }

  const gs1Match = trimmed.match(GS1_GTIN);
  if (gs1Match) {
    agregarCodigo(candidatos, gs1Match[1]);
    const gtin13 = gs1Match[1].length === 14 && gs1Match[1].startsWith('0')
      ? gs1Match[1].substring(1)
      : null;
    if (gtin13) {
      agregarCodigo(candidatos, gtin13);
    }
  }

  const alphaMatch = trimmed.match(ALPHANUM_TOKEN);
  if (alphaMatch && alphaMatch[1] !== numericMatch?.[1]) {
    agregarCodigo(candidatos, alphaMatch[1]);
  }

  if (!/\s/.test(trimmed) && SINGLE_TOKEN_CODE.test(trimmed)) {
    agregarCodigo(candidatos, trimmed);
  }

  if (NUMERIC_BARCODE.test(trimmed)) {
    agregarCodigo(candidatos, trimmed);
  }

  return candidatos;
}

/** @deprecated Usar codigosParaBuscar; mantiene compatibilidad. */
export function extractCodigoBarra(text: string): string | null {
  const candidatos = codigosParaBuscar(text);
  return candidatos.length > 0 ? candidatos[0] : null;
}

/**
 * Decide si el texto parece un código y no una descripción.
 *
 * 🐛 Corrige un bug heredado de `frc-mobile`: allá esta función devolvía
 * `codigosParaBuscar(text).length > 0`, y como el patrón alfanumérico acepta
 * cualquier token de 4+ caracteres, `"coca cola dos litros"` daba `true`. La
 * función era efectivamente inútil para distinguir código de descripción.
 *
 * Ahora exige que **todo** el texto tenga forma de código: sin espacios y con
 * el patrón de un numérico o de un token único.
 */
export function pareceBusquedaPorCodigo(text: string): boolean {
  const trimmed = text?.trim() ?? '';
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }
  return (
    esCodigoPesable(trimmed) ||
    NUMERIC_BARCODE.test(trimmed) ||
    SINGLE_TOKEN_CODE.test(trimmed) ||
    GS1_GTIN.test(trimmed)
  );
}

/**
 * Código de balanza: 13 dígitos con prefijo `20`.
 *
 * Se valida que el resto sea numérico. Sin eso, un Code128 alfanumérico de 13
 * caracteres que empezara con "20" se tomaba por pesable, y
 * `parseCodigoPesable` devolvía `NaN` como peso — un dato corrupto mostrado
 * al operador en vez de una búsqueda normal de código.
 */
export function esCodigoPesable(text: string): boolean {
  return /^20\d{11}$/.test(text?.trim() ?? '');
}

export function parseCodigoPesable(text: string): { codigoInterno: string; peso: number } {
  const t = text.trim();
  return {
    codigoInterno: t.substring(2, 7),
    peso: +t.substring(7, 12) / 1000,
  };
}
