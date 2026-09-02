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
  // `Intl` formatea el cero negativo como "-0". En una pantalla de arqueo,
  // donde el rojo del negativo llama la atención, un resultado balanceado no
  // debe verse como faltante.
  const normalizado = Object.is(valor, -0) ? 0 : valor;
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(normalizado);

  return simbolo ? `${simbolo} ${numero}` : numero;
}

/**
 * Parsea un importe escrito por el usuario.
 *
 * El formato de referencia es `es-PY` —punto para miles, coma para
 * decimales— pero **no se puede asumir**: los teclados numéricos de Android
 * e iOS insertan `.` como tecla decimal según el idioma del sistema, no el de
 * la app, y en Paraguay es habitual tener el teléfono en inglés.
 *
 * Por eso, si el texto no tiene coma y termina en un punto seguido de 1 o 2
 * dígitos, ese punto se interpreta como separador decimal. Sin esta regla,
 * `"10.50"` se leía como `1050`: un error de 100× que llegaba al backend sin
 * ninguna validación que lo frenara.
 *
 * Devuelve `null` si el texto no representa un número.
 */
export function parsearImporte(texto: string | null | undefined): number | null {
  if (texto == null) {
    return null;
  }

  const soloNumerico = String(texto)
    .trim()
    .replace(/[^\d,.-]/g, '');

  if (soloNumerico === '' || soloNumerico === '-') {
    return null;
  }

  let normalizado: string;
  if (soloNumerico.includes(',')) {
    // Con coma presente, el punto es separador de miles.
    normalizado = soloNumerico.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{1,2}$/.test(soloNumerico)) {
    // Un único punto final con 1-2 decimales: es la tecla decimal.
    const partes = soloNumerico.split('.');
    const decimales = partes.pop() as string;
    normalizado = `${partes.join('')}.${decimales}`;
  } else {
    normalizado = soloNumerico.replace(/\./g, '');
  }

  const valor = Number(normalizado);
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
  // Redondeo simétrico. `Math.round` lleva los `.5` hacia +∞, así que un
  // sobrante de +1234,5 y un faltante de -1234,5 redondeaban a magnitudes
  // distintas — inaceptable en una diferencia de arqueo.
  const signo = valor < 0 ? -1 : 1;
  return (signo * Math.round(Math.abs(valor) * factor)) / factor;
}

export function esEntero(n: number): boolean {
  return Number.isFinite(n) && n % 1 === 0;
}

/**
 * Cantidades que no son dinero: pesos en kilos, unidades.
 *
 * ⚠️ **No usar el pipe `number` de Angular para esto.** La app no registra
 * `LOCALE_ID`, así que el pipe formatea en `en-US` y un peso de 1,5 kg sale
 * como `1.500 kg` — que acá se lee «mil quinientos kilos». El punto y la coma
 * están invertidos respecto de lo que espera un usuario paraguayo, y el
 * resultado no parece un error de formato: parece otro número.
 *
 * Todo lo que sea dinero va por `formatearImporte`, que además resuelve la
 * precisión según la moneda.
 */
export function formatearCantidad(
  valor: number | null | undefined,
  decimales = 0,
): string {
  if (valor == null || !Number.isFinite(valor)) {
    return '';
  }
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

/** Decimales con los que se muestra el peso de un pesable (kg). */
export const PRECISION_PESABLE = 3;

/**
 * Existencia de un producto en una sucursal.
 *
 * ⚠️ **Un producto por unidad no lleva decimales.** El stock vuelve del
 * central como `Double` aunque cuente cajas, y mostrar `12,00` invita a leer
 * que hay una fracción de unidad en algún lado. Solo el producto de balanza
 * —el que se vende por peso— tiene decimales que significan algo.
 *
 * Si el producto no es de balanza pero la existencia igual llega fraccionada
 * —un ajuste mal cargado— se muestran los decimales en vez de esconderlos
 * detrás de un redondeo: es un dato que hay que ver, no uno que hay que
 * disimular.
 */
export function formatearExistencia(
  valor: number | null | undefined,
  pesable?: boolean | null,
): string {
  if (valor == null || !Number.isFinite(valor)) {
    return '';
  }
  if (pesable) {
    return formatearCantidad(valor, PRECISION_PESABLE);
  }
  return formatearCantidad(valor, esEntero(valor) ? 0 : PRECISION_DECIMAL);
}
