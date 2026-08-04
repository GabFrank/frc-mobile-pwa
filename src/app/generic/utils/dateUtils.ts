import { formatDate } from '@angular/common';

/** Formato que espera el backend para fechas: `yyyy-MM-dd HH:mm`. */
export function dateToString(date: Date | null | undefined): string | undefined {
  if (date == null) {
    return undefined;
  }
  return formatDate(date, 'yyyy-MM-dd HH:mm', 'en-US');
}

/**
 * Milisegundos a `HH:MM:SS`.
 *
 * Las horas NO se limitan a 24: 36 horas dan `36:15:31`. Es intencional —
 * se usa para duraciones acumuladas, no para hora del día.
 */
export function convertMsToTime(milliseconds: number): string {
  const totalSegundos = Math.floor(milliseconds / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return [horas, minutos, segundos].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Convierte lo que manda el central a algo legible: `dd/MM/yyyy HH:mm`.
 *
 * El parseo es manual a propósito. El central serializa las fechas como
 * `yyyy-MM-dd HH:mm` —con espacio, no con la `T` de ISO 8601— y ese formato
 * NO está especificado: Chrome lo interpreta como hora local, Safari
 * devuelve `Invalid Date`. Dejarlo en manos de `new Date(string)` significa
 * que la fecha de apertura de una caja se ve distinta según el teléfono.
 *
 * Devuelve `null` si no hay nada que mostrar, para que la pantalla decida
 * qué poner en su lugar.
 */
export function fechaLegible(valor: string | Date | null | undefined): string | null {
  if (valor == null || valor === '') {
    return null;
  }
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : formatDate(valor, 'dd/MM/yyyy HH:mm', 'en-US');
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(valor);
  if (!m) {
    return null;
  }
  const [, anio, mes, dia, hora, minuto] = m;
  return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}
