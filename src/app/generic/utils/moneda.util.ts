/**
 * Formateo y parseo de importes.
 *
 * ⚠️ **El guaraní no lleva decimales.** Es la regla de negocio que este
 * archivo existe para encapsular: duplicarla en cada pantalla garantiza que
 * en algún lado terminen apareciendo dos decimales de más.
 *
 * Reemplaza a `numbersUtils.ts` de `frc-mobile`, que hacía el formateo
 * insertando puntos a mano con `slice`. Acá se usa `Intl.NumberFormat`, que
 * ya conoce las convenciones de `es-PY`.
 */

export const LOCALE = 'es-PY';

export const PRECISION_GUARANI = 0;
export const PRECISION_DECIMAL = 2;

/** Símbolos que identifican al guaraní en el texto de una moneda. */
const PATRONES_GUARANI = ['GUARANI', 'GUARANÍ', '₲', 'GS.', 'PYG'];

/**
 * Detecta el guaraní por el texto de la moneda.
 *
 * ⚠️ Es detección por substring, heredada del backend: si alguien renombra
 * la moneda a algo que no contenga ninguno de estos patrones, los guaraníes
 * pasan a mostrarse con dos decimales sin ningún error visible.
 */
export function esGuarani(texto: string | null | undefined): boolean {
  const normalizado = (texto ?? '').toUpperCase();
  return PATRONES_GUARANI.some((p) => normalizado.includes(p));
}

export function precisionDe(monedaTexto: string | null | undefined): number {
  return esGuarani(monedaTexto) ? PRECISION_GUARANI : PRECISION_DECIMAL;
}

/**
 * Formatea un importe según la moneda.
 *
 * @param valor   Importe. `null`/`undefined` devuelven cadena vacía.
 * @param moneda  Texto o símbolo de la moneda; define la precisión.
 * @param simbolo Símbolo a anteponer. Si se omite, no se antepone nada.
 */
export function formatearImporte(
  valor: number | null | undefined,
  moneda?: string | null,
  simbolo?: string | null,
): string {
  if (valor == null || !Number.isFinite(valor)) {
    return '';
  }
  const precision = precisionDe(moneda);
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(valor);

  return simbolo ? `${simbolo} ${numero}` : numero;
}

/**
 * Parsea un importe escrito por el usuario en formato `es-PY`
 * (punto para miles, coma para decimales).
 *
 * Devuelve `null` si el texto no representa un número.
 */
export function parsearImporte(texto: string | null | undefined): number | null {
  if (texto == null) {
    return null;
  }
  const limpio = String(texto)
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (limpio === '' || limpio === '-') {
    return null;
  }
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Redondea al número de decimales de la moneda.
 *
 * Importante antes de enviar al backend: un importe en guaraníes con
 * decimales es un dato inválido, no un detalle de presentación.
 */
export function redondearAMoneda(
  valor: number,
  moneda?: string | null,
): number {
  const precision = precisionDe(moneda);
  const factor = 10 ** precision;
  return Math.round(valor * factor) / factor;
}

export function esEntero(n: number): boolean {
  return Number.isFinite(n) && n % 1 === 0;
}
