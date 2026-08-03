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
