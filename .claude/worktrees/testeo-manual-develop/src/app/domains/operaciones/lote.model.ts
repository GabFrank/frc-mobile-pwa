/**
 * Maestro de lotes.
 *
 * Un lote es la fila que hace que dos recepciones del mismo número terminen
 * sumando en el mismo saldo. Lo crea el **backend** —`LoteService.obtenerOCrear`—
 * al finalizar la recepción, no el cliente: acá solo se lee para sugerir lo que
 * ya existe mientras se tipea.
 *
 * ⚠️ **El número se normaliza con trim + mayúsculas.** Es la misma regla que
 * aplica el central (`LoteService.normalizarNumeroLote`), y existe para que
 * « lote2026101 » y «LOTE2026101» no sean dos lotes distintos.
 */
export enum EstadoLote {
  LIBERADO = 'LIBERADO',
  CUARENTENA = 'CUARENTENA',
  BLOQUEADO = 'BLOQUEADO',
  AGOTADO = 'AGOTADO',
}

export const ESTADO_LOTE_ETIQUETAS: Record<EstadoLote, string> = {
  [EstadoLote.LIBERADO]: 'Liberado',
  [EstadoLote.CUARENTENA]: 'En cuarentena',
  [EstadoLote.BLOQUEADO]: 'Bloqueado',
  [EstadoLote.AGOTADO]: 'Agotado',
};

export interface Lote {
  id?: number;
  numeroLote?: string;
  /** `yyyy-MM-dd`. */
  fechaVencimiento?: string;
  /**
   * Fecha a partir de la cual la mercadería tiene que salir de stock. FEFO
   * ordena por esta y no por el vencimiento: la idea es sacar el producto
   * antes de que venza, no el último día.
   */
  fechaRetiro?: string;
  fechaFabricacion?: string;
  estado?: EstadoLote;
  observacion?: string;
}

/** Fuera de circulación: bloqueado o en cuarentena. Se avisa al operador. */
export function loteRequiereAtencion(lote: Lote | null | undefined): boolean {
  return !!lote?.estado && lote.estado !== EstadoLote.LIBERADO;
}

/** trim + mayúsculas, igual que `LoteService.normalizarNumeroLote` del central. */
export function normalizarNumeroLote(numero: string | null | undefined): string {
  return (numero ?? '').trim().toUpperCase();
}
