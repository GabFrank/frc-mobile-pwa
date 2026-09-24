/**
 * Conversiones entre las tres formas que tiene una fecha en este repo.
 *
 * | Forma | Quién la usa |
 * |---|---|
 * | `yyyy-MM-dd` | el central, y lo que viaja en los inputs de GraphQL |
 * | `Date` | el calendario de Material |
 * | `dd/MM/yyyy` | lo que se escribe y se lee en pantalla |
 *
 * Están acá y no en el componente porque cada una falla en silencio —un día
 * corrido, un 31 de febrero que se convierte en 3 de marzo— y eso se ve en un
 * test, no mirando la pantalla.
 */

/**
 * ⚠️ **No es `new Date(texto)`.** El central manda `yyyy-MM-dd HH:mm` —con
 * espacio, no con la `T` de ISO 8601—, que Safari lee como `Invalid Date`.
 * Y `new Date('2026-03-15')` es medianoche **UTC**: al oeste de Greenwich
 * —Paraguay— cae el día anterior.
 *
 * La época Unix es cómo el central serializa una fecha nula, no un
 * vencimiento de 1970.
 */
export function desdeIso(valor: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  if (!m) {
    return null;
  }
  const [, anio, mes, dia] = m;
  if (`${anio}-${mes}-${dia}` === '1970-01-01') {
    return null;
  }
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

/**
 * ⚠️ **No es `toISOString().slice(0, 10)`.** Eso convierte a UTC: el 15 a las
 * 21:00 en Asunción ya es el 16 en Greenwich, y el vencimiento se guardaba
 * corrido un día — pero solo para quien contaba de noche, que es lo que hace
 * al error difícil de reproducir.
 */
export function aIso(fecha: Date | null | undefined): string | null {
  if (fecha == null || Number.isNaN(fecha.getTime())) {
    return null;
  }
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Lee lo que alguien escribe a mano: `dd/MM/yyyy`.
 *
 * ⚠️ **`Date.parse('15/03/2026')` da `Invalid Date`**: el parser nativo lee
 * `MM/dd/yyyy`. Es lo que hace `NativeDateAdapter.parse`, y por eso el
 * adaptador de Material no alcanza solo — con él, escribir la fecha en vez de
 * elegirla del calendario vaciaba el campo.
 *
 * El chequeo de que el día exista tampoco es cosmético: `new Date(2026, 1, 31)`
 * se corre solo al 3 de marzo, así que sin él el campo aceptaría un 31/02 y
 * mostraría otra fecha.
 */
export function parsearFechaPy(texto: string | null | undefined): Date | null {
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec((texto ?? '').trim());
  if (!m) {
    return null;
  }
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return null;
  }
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getMonth() === mes - 1 && fecha.getDate() === dia ? fecha : null;
}

/**
 * `dd/MM/yyyy`, con los ceros.
 *
 * Los mismos que pone `fechaLegible()`: dos formatos distintos para la misma
 * fecha en la misma pantalla se leen como dos fechas.
 */
export function formatearFechaPy(fecha: Date | null | undefined): string {
  if (fecha == null || Number.isNaN(fecha.getTime())) {
    return '';
  }
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}
