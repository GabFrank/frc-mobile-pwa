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
