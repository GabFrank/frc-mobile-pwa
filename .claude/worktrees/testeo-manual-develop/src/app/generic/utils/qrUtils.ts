/**
 * QR internos de la app.
 *
 * Formato:
 *   frc-{sucursalId}-{tipoEntidad}-{idOrigen}-{idCentral}-{componentToOpen}-{data}-{timestamp}
 *
 * Limitación conocida (TODO_TECNICO #11 de frc-mobile): el separador es el
 * guion, así que un campo que contenga un guion desplaza todo lo siguiente.
 * Se mantiene el formato por compatibilidad con los QR ya impresos; el
 * decodificador ahora valida el prefijo y la cantidad de partes en vez de
 * aceptar cualquier cadena.
 */

export const QR_PREFIJO = 'frc';

/**
 * Mínimo de campos para tomar la cadena por un QR del sistema.
 *
 * Son **siete y no ocho**, aunque `codificarQr` siempre emita ocho, porque el
 * central emite una variante corta que no pasa por este archivo:
 *
 * ```java
 * // PreGastoService.java — construirQrRetiro()
 * "frc-" + sucursalCajaId + "-PRE_GASTO_RETIRO-" + preGastoId + "-"
 *        + sucursalId + "-" + qrToken + "-" + timestamp
 * ```
 *
 * Son siete campos: el timestamp cae en la posición de `data` y `timestamp`
 * queda vacío. `frc-mobile` no validaba nada y lo aceptaba de casualidad;
 * cuando este decodificador empezó a exigir ocho, **el escaneo de retiro de
 * caja chica dejó de funcionar del todo** — el QR que imprime el cajero se
 * rechazaba con «Ese código no es de esta aplicación».
 *
 * Exigir siete sigue descartando basura: hace falta el prefijo `frc-` y seis
 * separadores. Lo que no se puede es exigir la longitud de una sola de las
 * variantes que el sistema realmente emite.
 */
const PARTES_MINIMAS = 7;

export interface QrData {
  sucursalId?: string;
  tipoEntidad?: string;
  idOrigen?: string;
  idCentral?: string;
  componentToOpen?: string;
  data?: string;
  timestamp?: string;
}

export function codificarQr(data: QrData): string {
  return [
    QR_PREFIJO,
    data.sucursalId ?? '',
    data.tipoEntidad ?? '',
    data.idOrigen ?? '',
    data.idCentral ?? '',
    data.componentToOpen ?? '',
    data.data ?? '',
    data.timestamp ?? '',
  ].join('-');
}

/** Devuelve `null` si el texto no es un QR de este sistema. */
export function descodificarQr(codigo: string | null | undefined): QrData | null {
  if (!codigo || !codigo.startsWith(`${QR_PREFIJO}-`)) {
    return null;
  }
  const partes = codigo.split('-');
  if (partes.length < PARTES_MINIMAS) {
    return null;
  }
  return {
    sucursalId: partes[1],
    tipoEntidad: partes[2],
    idOrigen: partes[3],
    idCentral: partes[4],
    componentToOpen: partes[5],
    data: partes[6],
    timestamp: partes[7],
  };
}
