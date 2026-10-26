/**
 * El QR de la etiqueta de una devolución.
 *
 * La etiqueta es **una por devolución** y su QR trae el identificador tal
 * cual: `DEV-{sucursal}-{id}`. No es un QR del sistema (`frc-…`): lo arma el
 * central al crear la devolución y es también lo que se lee escrito en la
 * etiqueta, así que se puede cargar a mano.
 *
 * El último número es el id de la devolución, el mismo en toda la red.
 */
const PATRON = /^DEV-(\d+)-(\d+)$/i;

/** `DEV-1-24` en mayúsculas y sin espacios, o `null` si no es un identificador. */
export function normalizarIdentificador(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim().toUpperCase();
  return PATRON.test(limpio) ? limpio : null;
}

/** El id de la devolución que identifica el texto, o `null`. */
export function devolucionDelIdentificador(texto: string | null | undefined): number | null {
  const limpio = normalizarIdentificador(texto);
  if (limpio == null) {
    return null;
  }
  const id = Number(PATRON.exec(limpio)![2]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
