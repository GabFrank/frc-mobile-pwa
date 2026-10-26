import type {
  AvisoFactura,
  RenglonFactura,
  SugerenciaProducto,
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

/**
 * La sugerencia que el central marcó como preseleccionada (lo aprendido por la
 * descripción, sin ambigüedad). Si por algún motivo viniera más de una, no se
 * preselecciona ninguna: se muestran todas como sugerencias comunes.
 */
export function sugerenciaPreseleccionada(
  r: Pick<RenglonFactura, 'sugerencias'>,
): SugerenciaProducto | null {
  const marcadas = (r.sugerencias ?? []).filter((s) => s.preseleccionada === true);
  return marcadas.length === 1 ? marcadas[0] : null;
}

/** Las sugerencias que no son la preseleccionada, para la lista «¿Es alguno de estos?». */
export function otrasSugerencias(r: Pick<RenglonFactura, 'sugerencias'>): SugerenciaProducto[] {
  const elegida = sugerenciaPreseleccionada(r);
  return (r.sugerencias ?? []).filter((s) => s !== elegida);
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
 * trae un aviso de IVA o una alerta del central (código de otro producto, dos
 * renglones al mismo producto) —no bloquean, pero es justamente lo que hay que ver—.
 */
export function paraRevisar(r: RenglonFactura): boolean {
  return r.estado !== 'OK' || (r.avisosIva?.length ?? 0) > 0 || (r.alertas?.length ?? 0) > 0;
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

/**
 * Los avisos de la factura que siguen valiendo. «La factura no dice la forma de
 * pago» sobra en cuanto el comprador la eligió: quedaba a la vista y parecía
 * que la elección no se había tomado.
 */
export function avisosVisibles(
  avisos: readonly AvisoFactura[],
  formaPagoElegida: boolean,
): AvisoFactura[] {
  return avisos.filter((a) => !(formaPagoElegida && a.tipo === 'PAGO'));
}

/**
 * El central dice que la factura ya tiene su compra o su nota: volver a pedirla
 * da el mismo rechazo, así que no se ofrece el botón de crear la compra.
 */
export function facturaYaUsada(motivo: string | null | undefined): boolean {
  return /ya est[aá] cargada|ya cre[oó] la compra/i.test(motivo ?? '');
}

/** Cuántas fotos admite una factura en papel (una factura larga ocupa varias hojas). */
export const MAX_FOTOS_FACTURA = 5;

/** Una factura en papel necesita más resolución que un ticket: el texto es chico y denso. */
export const OPCIONES_FOTO_FACTURA = { ladoMaximo: 2400, calidad: 0.85 };

/**
 * Número de factura completo `001-001-0001234`, rellenando con ceros cada tramo.
 * Devuelve `null` si algún tramo está vacío, no es numérico o excede 3-3-7.
 * Solo presentación: la validez de la factura la decide el central.
 */
export function numeroFacturaCompleto(
  establecimiento: string | null | undefined,
  puntoExpedicion: string | null | undefined,
  numero: string | null | undefined,
): string | null {
  const tramo = (valor: string | null | undefined, largo: number): string | null => {
    const t = (valor ?? '').trim();
    if (!/^\d+$/.test(t) || t.length > largo) {
      return null;
    }
    return t.padStart(largo, '0');
  };
  const est = tramo(establecimiento, 3);
  const pto = tramo(puntoExpedicion, 3);
  const num = tramo(numero, 7);
  return est && pto && num ? `${est}-${pto}-${num}` : null;
}
