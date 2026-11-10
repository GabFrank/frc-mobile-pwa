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
export function esGuarani(moneda: MonedaReferencia): boolean {
  const normalizado = textoDe(moneda).toUpperCase();
  return PATRONES_GUARANI.some((p) => normalizado.includes(p));
}

/**
 * Lo mínimo de una moneda que hace falta para formatear un importe.
 *
 * Es estructural a propósito: un `Moneda` del dominio, una fila de una query
 * que pidió solo algunos campos o un literal en un test sirven igual.
 */
export interface MonedaFormato {
  decimales?: number | null;
  denominacion?: string | null;
  codigoIso?: string | null;
  simbolo?: string | null;
}

/**
 * Cómo se le dice a este archivo de qué moneda es un importe: por el texto
 * de siempre —denominación o símbolo— o por la moneda misma.
 */
export type MonedaReferencia = string | MonedaFormato | null | undefined;

/** El texto con el que se reconoce una moneda cuando no dice sus decimales. */
function textoDe(moneda: MonedaReferencia): string {
  if (moneda == null) {
    return '';
  }
  if (typeof moneda === 'string') {
    return moneda;
  }
  return [moneda.codigoIso, moneda.denominacion, moneda.simbolo]
    .filter((t): t is string => typeof t === 'string')
    .join(' ');
}

/** Tope de `Intl.NumberFormat` para `maximumFractionDigits` que soportan todos los motores. */
const DECIMALES_MAXIMOS = 20;

/**
 * Decimales con los que se muestra y redondea un importe.
 *
 * Con una moneda que trae `decimales` —el dato del central—, manda ese dato.
 * Sin él, o con un texto, se decide como siempre: guaraní sin decimales y el
 * resto con dos.
 *
 * ⚠️ Antes de `V207.5` del central `decimales` valía `0` en **todas** las
 * monedas, también en el dólar. No hace falta defenderse de eso: el campo
 * entró al schema en el mismo merge que esa migración, así que un central que
 * lo expone ya tiene el dato corregido.
 */
export function precisionDe(moneda: MonedaReferencia): number {
  if (moneda != null && typeof moneda === 'object') {
    const d = moneda.decimales;
    if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= DECIMALES_MAXIMOS) {
      return d;
    }
  }
  return esGuarani(moneda) ? PRECISION_GUARANI : PRECISION_DECIMAL;
}

/**
 * Un formateador por precisión, reusado.
 *
 * Construir un `Intl.NumberFormat` cuesta mucho más que usarlo, y el pipe de
 * importes se reevalúa en cada detección de cambios de su vista.
 */
const formateadores = new Map<number, Intl.NumberFormat>();

function formateadorDe(precision: number): Intl.NumberFormat {
  let f = formateadores.get(precision);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    formateadores.set(precision, f);
  }
  return f;
}

/**
 * Formatea un importe según la moneda.
 *
 * @param valor   Importe. `null`/`undefined` devuelven cadena vacía.
 * @param moneda  Texto o símbolo de la moneda, o la moneda misma; define la precisión.
 * @param simbolo Símbolo a anteponer. Si se omite, no se antepone nada.
 */
export function formatearImporte(
  valor: number | null | undefined,
  moneda?: MonedaReferencia,
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
  const numero = formateadorDe(precision).format(normalizado);

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
  moneda?: MonedaReferencia,
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
