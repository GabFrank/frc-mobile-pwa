import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import type { FiltrosTransferencia } from './transferencia.service';

/**
 * Los filtros que el usuario pone en la lista de transferencias.
 *
 * Viven acá, sin Angular, porque se aplican por dos caminos y tienen que dar
 * lo mismo por los dos: en Salen / Llegan / Todas los resuelve el central
 * (`aVariables`), y en «Mías» —cuya consulta no acepta ninguno— se aplican
 * sobre lo que ya llegó (`coincide`).
 */
export interface FiltrosLista {
  estado: string | null;
  /** `yyyy-MM-dd`, como lo entrega `frc-campo-fecha`. */
  desde: string | null;
  hasta: string | null;
  origenId: number | null;
  destinoId: number | null;
}

export const SIN_FILTROS: FiltrosLista = {
  estado: null,
  desde: null,
  hasta: null,
  origenId: null,
  destinoId: null,
};

/** Cuántos hay puestos. El rango de fechas cuenta como uno. */
export function filtrosActivos(f: FiltrosLista): number {
  return [f.estado, f.desde ?? f.hasta, f.origenId, f.destinoId].filter((v) => v != null).length;
}

/**
 * Los filtros como los espera `transferenciasWithFilters`.
 *
 * ⚠️ **«Hasta» viaja con `23:59:59`.** El central compara `creadoEn <= hasta`
 * y una fecha sola la lee como medianoche: sin la hora, el último día del
 * rango queda afuera entero. Los dos formatos —10 y 19 caracteres— son los
 * que entiende `DateUtils.stringToDate`.
 *
 * ⚠️ **Va `estado`, no `estados`.** El central los **une**: mandar los dos
 * amplía la lista en vez de acotarla.
 */
export function aVariables(
  f: FiltrosLista,
): Pick<
  FiltrosTransferencia,
  'estado' | 'creadoDesde' | 'creadoHasta' | 'sucursalOrigenId' | 'sucursalDestinoId'
> {
  return {
    estado: f.estado,
    creadoDesde: f.desde,
    creadoHasta: f.hasta ? `${f.hasta} 23:59:59` : null,
    sucursalOrigenId: f.origenId ?? undefined,
    sucursalDestinoId: f.destinoId ?? undefined,
  };
}

/**
 * El día de `creadoEn`, que el central manda como `yyyy-MM-dd HH:mm` en la
 * hora del servidor: la misma referencia contra la que compara su filtro.
 *
 * La época Unix es cómo llega una fecha nula, no un día de 1970.
 */
function diaDe(creadoEn: string | null | undefined): string | null {
  const dia = /^\d{4}-\d{2}-\d{2}/.exec(creadoEn ?? '')?.[0] ?? null;
  return dia === '1970-01-01' ? null : dia;
}

/**
 * `true` si la transferencia pasa los filtros. Es el espejo de lo que hace el
 * central, para «Mías».
 *
 * ⚠️ **Con filtro de fecha, una transferencia sin `creadoEn` no pasa**: el
 * central tampoco la devuelve, y las pestañas no pueden responder distinto.
 */
export function coincide(t: Transferencia, f: FiltrosLista): boolean {
  if (f.estado != null && t.estado !== f.estado) {
    return false;
  }
  if (f.desde != null || f.hasta != null) {
    const dia = diaDe(t.creadoEn);
    if (dia == null || (f.desde != null && dia < f.desde) || (f.hasta != null && dia > f.hasta)) {
      return false;
    }
  }
  // Los ids llegan a veces como número y a veces como texto.
  if (f.origenId != null && Number(t.sucursalOrigen?.id) !== f.origenId) {
    return false;
  }
  if (f.destinoId != null && Number(t.sucursalDestino?.id) !== f.destinoId) {
    return false;
  }
  return true;
}
