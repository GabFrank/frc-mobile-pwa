import type {
  AvisoFactura,
  RenglonFactura,
} from 'src/app/domains/compras/compras.model';
import type { TonoEstado } from 'src/app/shared/estado/estado-registry';

/**
 * Reglas de presentación de Compras. Puras, con su spec.
 *
 * ⚠️ **Acá no se decide nada de negocio.** Qué renglón tiene diferencia, qué
 * exige observación y si la factura se puede confirmar lo dice el central;
 * estas funciones solo eligen cómo mostrarlo.
 */

/**
 * ¿Lo que se leyó es el QR de un KuDE o el CDC impreso debajo?
 *
 * El escáner universal lo usa para no mandarlo al buscador de productos. La
 * validación de verdad —dígito verificador, que sea una factura, que sea
 * nuestra— la hace el central: acá alcanza con reconocer la forma.
 */
export function esKude(texto: string | null | undefined): boolean {
  const t = (texto ?? '').trim();
  if (!t) {
    return false;
  }
  if (/ekuatia\.set\.gov\.py/i.test(t) && /[?&](amp;)?id=\d{44}/i.test(t)) {
    return true;
  }
  return /^\d{44}$/.test(t.replace(/\s+/g, ''));
}

/** Id positivo, o `null`. `Number('')` es 0: ver PATRONES §7. */
export function aId(valor: unknown): number | null {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return null;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export function tonoRenglon(estado: string | null | undefined): TonoEstado {
  switch (estado) {
    case 'OK':
      return 'ok';
    case 'DIFERENCIA':
    case 'FUERA_DE_PEDIDO':
      return 'warn';
    case 'SIN_PRODUCTO':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function tonoAviso(aviso: Pick<AvisoFactura, 'nivel'>): TonoEstado {
  switch (aviso.nivel) {
    case 'BLOQUEO':
      return 'danger';
    case 'ADVERTENCIA':
      return 'warn';
    default:
      return 'info';
  }
}

export type FiltroRenglones = 'todos' | 'revisar' | 'sin-producto' | 'ok';

/**
 * «Para revisar» es todo lo que el comprador tiene que tocar: diferencias,
 * productos fuera del pedido, sin producto, y también lo que coincide pero
 * trae un aviso de IVA —no bloquea, pero es justamente lo que pidió ver—.
 */
export function paraRevisar(r: RenglonFactura): boolean {
  return r.estado !== 'OK' || (r.avisosIva?.length ?? 0) > 0;
}

export function filtrarRenglones(
  renglones: readonly RenglonFactura[],
  filtro: FiltroRenglones,
): RenglonFactura[] {
  switch (filtro) {
    case 'revisar':
      return renglones.filter(paraRevisar);
    case 'sin-producto':
      return renglones.filter((r) => r.estado === 'SIN_PRODUCTO');
    case 'ok':
      return renglones.filter((r) => !paraRevisar(r));
    default:
      return [...renglones];
  }
}

export function contarFiltros(
  renglones: readonly RenglonFactura[],
): Record<FiltroRenglones, number> {
  return {
    todos: renglones.length,
    revisar: renglones.filter(paraRevisar).length,
    'sin-producto': renglones.filter((r) => r.estado === 'SIN_PRODUCTO').length,
    ok: renglones.filter((r) => !paraRevisar(r)).length,
  };
}

/** «80 UNI × 15.651» para la línea de la factura. Solo formatea. */
export function cantidadPorPrecio(r: Pick<RenglonFactura, 'cantidad' | 'unidadMedida'>): string {
  const cantidad = r.cantidad ?? 0;
  const unidad = r.unidadMedida ? ' ' + r.unidadMedida : '';
  return cantidad.toLocaleString('es-PY', { maximumFractionDigits: 3 }) + unidad;
}

/** El texto del factor: «1 CAJ = 20 u.». */
export function textoFactor(factor: number | null | undefined, unidad?: string | null): string {
  const f = factor != null && factor > 0 ? factor : 1;
  return '1 ' + (unidad || 'u. de la factura') + ' = ' + f.toLocaleString('es-PY', { maximumFractionDigits: 3 }) + ' u.';
}

const PALABRAS_VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'CON', 'SIN', 'POR', 'PARA']);

/**
 * Lo que se precarga en el buscador para un renglón no reconocido: las
 * primeras palabras de la descripción del proveedor, sin el «C/20» ni los
 * gramajes, que en nuestra descripción suelen estar escritos de otra forma.
 */
export function textoParaBuscar(descripcion: string | null | undefined): string {
  const palabras = (descripcion ?? '')
    .toUpperCase()
    .replace(/C\/\s*\d+/g, ' ')
    .replace(/[^A-Z0-9ÁÉÍÓÚÑÜ ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !/^\d+[A-Z]*$/.test(p) && !PALABRAS_VACIAS.has(p));
  return palabras.slice(0, 3).join(' ');
}

/**
 * El tono del chip de la etapa en la lista: amarillo lo que espera al
 * comprador (la factura), azul lo que sigue en otra área, verde lo terminado.
 */
export function tonoEtapa(
  etapaActual: string | null | undefined,
  estadoNotas?: string | null,
): TonoEstado {
  switch (etapaActual) {
    case 'RECEPCION_NOTA':
      return estadoNotas === 'EN_PROCESO' ? 'info' : 'warn';
    case 'CREACION':
      return 'neutral';
    case 'RECEPCION_MERCADERIA':
    case 'SOLICITUD_PAGO':
      return 'info';
    case 'CONCLUIDA':
      return 'ok';
    default:
      return 'neutral';
  }
}

/** Lo que se tolera entre la suma del reparto y el renglón (redondeos). */
const TOLERANCIA_REPARTO = 0.001;

/**
 * El reparto que se propone al elegir varias sucursales: partes iguales y, si
 * la cantidad es entera, enteras (14 cajas en 3 → 5, 5, 4). Solo prellena: el
 * comprador lo corrige y el central valida que sume el renglón.
 */
export function repartoIgual(cantidad: number | null | undefined, partes: number): number[] {
  if (partes <= 0) return [];
  const total = cantidad ?? 0;
  if (Number.isInteger(total)) {
    const base = Math.floor(total / partes);
    const sobra = total - base * partes;
    return Array.from({ length: partes }, (_, i) => base + (i < sobra ? 1 : 0));
  }
  const parte = Math.floor((total / partes) * 1000) / 1000;
  const resultado = Array.from({ length: partes }, () => parte);
  resultado[partes - 1] = Math.round((total - parte * (partes - 1)) * 1000) / 1000;
  return resultado;
}

export function sumaReparto(valores: readonly (number | null | undefined)[]): number {
  return valores.reduce<number>((suma, v) => suma + (v ?? 0), 0);
}

/** ¿El reparto cubre el renglón entero, sin negativos? */
export function repartoCompleto(
  cantidad: number | null | undefined,
  valores: readonly (number | null | undefined)[],
): boolean {
  if (valores.some((v) => v != null && v < 0)) return false;
  return Math.abs(sumaReparto(valores) - (cantidad ?? 0)) <= TOLERANCIA_REPARTO;
}
