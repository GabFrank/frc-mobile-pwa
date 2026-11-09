/** Los mismos que valida el central (`RecuperacionContrasenaService.EMAIL`) y el desktop. */
export const EMAIL_VALIDO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export const TELEFONO_VALIDO = /^[0-9+ ()-]{6,20}$/;

export interface SolicitudGuardada {
  solicitudId: number;
  codigoSecreto: string;
}

const CLAVE = 'frc.recuperacion.solicitud';

/**
 * La solicitud a RRHH recién creada, mientras no se complete.
 *
 * El central muestra el código secreto **una sola vez**, y para mandarla hay
 * que salir a WhatsApp: el teléfono puede descartar la pestaña en el medio.
 * Sin esto el código se perdía, la solicitud quedaba viva sin que nadie
 * pudiera usarla, y pedir otra anula la anterior y gasta una de las tres del
 * día. `sessionStorage` sobrevive a esa recarga y muere con la pestaña.
 */
export function guardarSolicitud(s: SolicitudGuardada): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(s));
  } catch {
    // Sin almacenamiento (modo privado): queda el «Copiar».
  }
}

export function leerSolicitudGuardada(): SolicitudGuardada | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    const s = crudo ? (JSON.parse(crudo) as Partial<SolicitudGuardada>) : null;
    return s && Number.isInteger(s.solicitudId) && (s.solicitudId as number) > 0 && typeof s.codigoSecreto === 'string'
      ? (s as SolicitudGuardada)
      : null;
  } catch {
    return null;
  }
}

export function borrarSolicitudGuardada(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}
