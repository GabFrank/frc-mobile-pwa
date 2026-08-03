/**
 * Claves de almacenamiento de la sesión.
 *
 * Se usa `removeItem` para limpiar, nunca `setItem(clave, null)`:
 * eso persistía la cadena "null" y obligaba a chequeos defensivos
 * en todo el código del repo anterior.
 */
export const AUTH_TOKEN_KEY = 'frc.token';
export const AUTH_USER_ID_KEY = 'frc.usuarioId';
export const DEVICE_ID_KEY = 'frc.deviceId';

/**
 * Lee el id de usuario en sesión.
 *
 * Vive acá y no en `AuthService` para que `DatosService` pueda usarlo sin
 * crear un ciclo de dependencias, y para que la regla de parseo —incluido el
 * chequeo defensivo contra la cadena "null" heredada— exista en un solo lugar.
 */
export function leerUsuarioIdEnSesion(): number | null {
  const crudo = localStorage.getItem(AUTH_USER_ID_KEY);
  if (!crudo || crudo === 'null') {
    return null;
  }
  const id = Number(crudo);
  return Number.isFinite(id) ? id : null;
}

/** `true` si hay un token de sesión utilizable. */
export function hayTokenEnSesion(): boolean {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return !!token && token !== 'null';
}
