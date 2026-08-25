import {
  ESTADO_LOTE_ETIQUETAS,
  Lote,
  loteRequiereAtencion,
  normalizarNumeroLote,
} from 'src/app/domains/operaciones/lote.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';

/**
 * Reglas de lote de la verificación de una recepción.
 *
 * Viven acá y no en el diálogo porque son la parte que se puede probar sin
 * montar el componente: qué se sugiere mientras se tipea, qué fecha se puede
 * escribir y cuándo falta el número.
 *
 * ⚠️ **El backend es el que manda.** `LoteService.obtenerOCrear` crea o
 * reutiliza el lote del maestro y **nunca pisa una fecha ya cargada**; lo de
 * acá solo evita mostrarle al operador algo distinto de lo que se va a
 * guardar, y ahorrarle un viaje al servidor para enterarse.
 */

/** Más que esto deja de ser una ayuda y pasa a ser un listado. */
export const MAX_SUGERENCIAS_LOTE = 6;

/** Una opción del reconocimiento de lote, con todo ya formateado. */
export interface LoteSugerido {
  numeroLote: string;
  /** Vencimiento, retiro y estado, listos para pintar. */
  detalle: string;
  /** Fuera de circulación —bloqueado o en cuarentena—: la opción va en rojo. */
  requiereAtencion: boolean;
}

/**
 * Una fecha del central lista para un `input type="date"`.
 *
 * El central serializa `Date` como `yyyy-MM-dd HH:mm` —con espacio, no con la
 * `T` de ISO 8601—, así que el input la descarta entera y el campo queda
 * vacío teniendo el dato.
 *
 * La época Unix es cómo llega una fecha ausente en varios campos del central,
 * no una fecha: un lote que vence el 1/1/1970 no existe.
 */
export function fechaDeLote(valor: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(valor ?? '');
  if (!m || m[1] === '1970-01-01') {
    return '';
  }
  return m[1];
}

/** Vencimiento, retiro y estado de un lote, en una línea. */
export function detalleDeLote(lote: Lote): string {
  const partes: string[] = [];
  const vencimiento = fechaLegible(lote.fechaVencimiento, { conHora: false });
  const retiro = fechaLegible(lote.fechaRetiro, { conHora: false });
  if (vencimiento) {
    partes.push('vence ' + vencimiento);
  }
  if (retiro) {
    partes.push('retiro ' + retiro);
  }
  if (loteRequiereAtencion(lote)) {
    partes.push(ESTADO_LOTE_ETIQUETAS[lote.estado!].toLowerCase());
  }
  return partes.length > 0 ? partes.join(' · ') : 'sin fechas cargadas';
}

/**
 * Índice por número normalizado, para reconocer lo que se va tipeando.
 *
 * Con dos filas del mismo número —que el maestro no debería tener: la unicidad
 * es producto + número— gana la primera, que por el orden FEFO del backend es
 * la de retiro más próximo.
 */
export function indexarLotes(lotes: Lote[]): Map<string, Lote> {
  const indice = new Map<string, Lote>();
  for (const lote of lotes) {
    const clave = normalizarNumeroLote(lote.numeroLote);
    if (clave && !indice.has(clave)) {
      indice.set(clave, lote);
    }
  }
  return indice;
}

/**
 * Lotes que empiezan con lo tipeado y después los que lo contienen; dentro de
 * cada grupo se respeta el orden FEFO con el que llegaron.
 *
 * El que ya está tipeado entero **no** se sugiere: ese se anuncia como «lote
 * ya registrado», que dice más que repetirlo en una lista.
 */
export function sugerenciasDeLote(
  lotes: Lote[],
  filtroCrudo: string,
  max = MAX_SUGERENCIAS_LOTE,
): LoteSugerido[] {
  const filtro = normalizarNumeroLote(filtroCrudo);
  const empiezan: Lote[] = [];
  const contienen: Lote[] = [];

  for (const lote of lotes) {
    const numero = normalizarNumeroLote(lote.numeroLote);
    if (!numero || numero === filtro) {
      continue;
    }
    if (!filtro || numero.startsWith(filtro)) {
      empiezan.push(lote);
    } else if (numero.includes(filtro)) {
      contienen.push(lote);
    }
  }

  return empiezan
    .concat(contienen)
    .slice(0, max)
    .map((lote) => ({
      numeroLote: lote.numeroLote ?? '',
      detalle: detalleDeLote(lote),
      requiereAtencion: loteRequiereAtencion(lote),
    }));
}

/**
 * Por qué no se puede guardar todavía, o `null` si se puede.
 *
 * Solo aplica a lo que efectivamente se recibe: una verificación que es toda
 * rechazo no tiene lote que informar. Es la misma regla que aplica el central
 * en `RecepcionMercaderiaItemService.validarLoteObligatorio` — acá está para
 * cortar antes, no para reemplazarla.
 */
export function validarLoteDeVerificacion(
  requiereLote: boolean,
  cantidadRecibida: number,
  numeroLote: string,
): string | null {
  if (!requiereLote || cantidadRecibida <= 0) {
    return null;
  }
  return normalizarNumeroLote(numeroLote)
    ? null
    : 'Este producto se mueve por lote: cargá el número.';
}
