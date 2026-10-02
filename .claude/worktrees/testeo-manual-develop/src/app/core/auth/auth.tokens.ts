/**
 * Claves y acceso al almacenamiento de la sesión.
 *
 * Se usa `removeItem` para limpiar, nunca `setItem(clave, null)`:
 * eso persistía la cadena "null" y obligaba a chequeos defensivos
 * en todo el código del repo anterior.
 */
export const AUTH_TOKEN_KEY = 'frc.token';
export const AUTH_USER_ID_KEY = 'frc.usuarioId';
export const DEVICE_ID_KEY = 'frc.deviceId';

/** Preferencia: precargar el usuario en el login. */
export const RECORDAR_USUARIO_KEY = 'frc.recordarUsuario';
/** El nombre recordado. **Nunca la contraseña.** */
export const USUARIO_RECORDADO_KEY = 'frc.usuarioRecordado';
/** Preferencia: que la sesión sobreviva al cierre del navegador. */
export const MANTENER_CONECTADO_KEY = 'frc.mantenerConectado';

/**
 * Dónde vive la sesión.
 *
 * Con "mantenerme conectado" la sesión va a `localStorage` y sobrevive a
 * cerrar el navegador. Sin eso va a `sessionStorage` y muere con la pestaña
 * —que es lo que espera alguien que entra desde una máquina compartida—.
 *
 * La preferencia sí vive siempre en `localStorage`: si viviera junto a la
 * sesión, al cerrar el navegador se olvidaría de que el usuario había pedido
 * no ser recordado.
 */
export function almacenDeSesion(): Storage {
  return leerBandera(MANTENER_CONECTADO_KEY) ? localStorage : sessionStorage;
}

/** Lee de donde esté, sin importar la preferencia actual. */
function leerDeCualquierAlmacen(clave: string): string | null {
  return sessionStorage.getItem(clave) ?? localStorage.getItem(clave);
}

export function guardarSesion(token: string, usuarioId: number): void {
  const almacen = almacenDeSesion();
  // Se limpia el otro almacén primero: si el usuario cambió la preferencia
  // entre dos logins, quedaría una sesión huérfana en el que ya no se usa,
  // y `leerDeCualquierAlmacen` podría devolver la vieja.
  limpiarSesion();
  almacen.setItem(AUTH_TOKEN_KEY, token);
  almacen.setItem(AUTH_USER_ID_KEY, String(usuarioId));
}

export function limpiarSesion(): void {
  for (const almacen of [localStorage, sessionStorage]) {
    almacen.removeItem(AUTH_TOKEN_KEY);
    almacen.removeItem(AUTH_USER_ID_KEY);
  }
}

/**
 * Lee el id de usuario en sesión.
 *
 * Vive acá y no en `AuthService` para que `DatosService` pueda usarlo sin
 * crear un ciclo de dependencias, y para que la regla de parseo —incluido el
 * chequeo defensivo contra la cadena "null" heredada— exista en un solo lugar.
 */
export function leerUsuarioIdEnSesion(): number | null {
  const crudo = leerDeCualquierAlmacen(AUTH_USER_ID_KEY);
  if (!crudo || crudo === 'null') {
    return null;
  }
  const id = Number(crudo);
  return Number.isFinite(id) ? id : null;
}

/** El token de sesión, o `null`. */
export function leerTokenEnSesion(): string | null {
  const token = leerDeCualquierAlmacen(AUTH_TOKEN_KEY);
  return token && token !== 'null' ? token : null;
}

/** `true` si hay un token de sesión utilizable. */
export function hayTokenEnSesion(): boolean {
  return leerTokenEnSesion() !== null;
}

// ─────────────────────────────────────────────────────────── Preferencias ──

/**
 * Las dos preferencias arrancan en `true`.
 *
 * ⚠️ Por eso se guarda `'false'` explícito y no se borra la clave: con un
 * default en `true`, borrarla equivale a volver a activarla, y el usuario
 * que apagó "mantenerme conectado" se lo encontraría prendido de nuevo.
 */
export function leerBandera(clave: string, porDefecto = true): boolean {
  const crudo = localStorage.getItem(clave);
  if (crudo === null) {
    return porDefecto;
  }
  return crudo === 'true';
}

export function guardarBandera(clave: string, valor: boolean): void {
  localStorage.setItem(clave, valor ? 'true' : 'false');
}

/** El usuario recordado para precargar el login. */
export function leerUsuarioRecordado(): string | null {
  return leerBandera(RECORDAR_USUARIO_KEY)
    ? (localStorage.getItem(USUARIO_RECORDADO_KEY) ?? null)
    : null;
}

/** `true` si la sesión debe sobrevivir al cierre del navegador. */
export function mantenerConectado(): boolean {
  return leerBandera(MANTENER_CONECTADO_KEY);
}

export function guardarUsuarioRecordado(nickname: string, recordar: boolean): void {
  guardarBandera(RECORDAR_USUARIO_KEY, recordar);
  if (recordar && nickname.trim()) {
    localStorage.setItem(USUARIO_RECORDADO_KEY, nickname.trim());
  } else {
    localStorage.removeItem(USUARIO_RECORDADO_KEY);
  }
}
