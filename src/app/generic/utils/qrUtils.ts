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
const PARTES_ESPERADAS = 8;

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
  if (partes.length < PARTES_ESPERADAS) {
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
