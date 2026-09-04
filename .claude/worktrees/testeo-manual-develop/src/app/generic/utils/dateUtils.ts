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
export function fechaLegible(
  valor: string | Date | null | undefined,
  opciones?: { conHora?: boolean },
): string | null {
  const conHora = opciones?.conHora ?? true;
  if (valor == null || valor === '') {
    return null;
  }
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime()) || valor.getTime() === 0) {
      return null;
    }
    return formatDate(valor, conHora ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', 'en-US');
  }
  if (esEpoch(valor)) {
    return null;
  }
  // La hora es OPCIONAL. El central manda `yyyy-MM-dd HH:mm` para lo que
  // ocurre en un momento —la apertura de una caja— y `yyyy-MM-dd` para lo que
  // ocurre en un día —la fecha de un vale, una jornada—. Exigir la hora hacía
  // que estas últimas devolvieran null y la pantalla mostrara "Sin fecha"
  // teniendo el dato.
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(valor);
  if (!m) {
    return null;
  }
  const [, anio, mes, dia, hora, minuto] = m;
  const fecha = `${dia}/${mes}/${anio}`;
  return conHora && hora != null ? `${fecha} ${hora}:${minuto}` : fecha;
}

/**
 * La época Unix es cómo llega una fecha ausente, no una fecha.
 *
 * El central serializa un `Date` nulo como `1970-01-01 00:00`, así que una
 * persona sin fecha de nacimiento cargada aparecía en pantalla nacida el 1
 * de enero de 1970 a las cero horas. Se ve en «Mi cuenta» de cualquier
 * usuario cuyo legajo no tenga el dato.
 *
 * El corte incluye la hora en cero a propósito: alguien nacido el 1/1/1970
 * es posible; nacido a las 00:00 exactas, no es un dato que este sistema
 * tenga cómo saber.
 */
function esEpoch(valor: string): boolean {
  // Anclado al final: sin el `$`, el grupo opcional simplemente no coincidía
  // y `1970-01-01 08:30` —una fecha real— entraba como época. Lo encontró
  // el test que cubre justamente ese caso.
  return /^1970-01-01(?:[T ]00:00(?::00(?:\.0+)?)?Z?)?$/.test(valor.trim());
}
