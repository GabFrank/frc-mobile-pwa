import { TipoDispositivo } from 'src/app/domains/configuracion/enums/tipo-dispositivo.model';

const CLAVE_DISPOSITIVO = 'frc.idDispositivo';

/**
 * Un id estable para **este** navegador en **este** equipo.
 *
 * ⚠️ **Es la clave con la que el central encuentra la sesión de este
 * aparato.** `actualizarTokenFcm` busca la sesión activa por
 * `(usuario, idDispositivo)`, y si no la encuentra escribe el token en *la
 * primera sesión abierta del usuario, sea del dispositivo que sea*. Con la
 * PWA sin registrar sesión, ese fallback llegó a escribir el token de este
 * navegador sobre la sesión **iOS** del mismo usuario: el iPhone dejaba de
 * recibir avisos y este equipo los recibía dos veces.
 *
 * Por eso el id se genera una sola vez y lo comparten el registro de sesión
 * y el registro del token. Son las dos mitades de lo mismo; `frc-mobile` las
 * tiene juntas desde siempre (`login.service.ts` → `registrarSesionActiva`).
 */
export function idDeDispositivo(): string {
  const guardado = localStorage.getItem(CLAVE_DISPOSITIVO);
  if (guardado) {
    return guardado;
  }
  const nuevo = crypto.randomUUID();
  localStorage.setItem(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

/**
 * `WEB_MOBILE` en un teléfono, `WEB` en un escritorio.
 *
 * El central usa esto para decidir cómo arma la notificación —Android, APNs o
 * webpush llevan configuraciones distintas— y para que soporte sepa desde
 * dónde entró alguien. No hay forma exacta de saberlo en la web, así que se
 * mira el puntero: un dispositivo sin puntero fino es un teléfono o una
 * tablet, que es exactamente la distinción que importa acá.
 */
export function tipoDeDispositivo(): TipoDispositivo {
  const grueso = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return grueso ? TipoDispositivo.WEB_MOBILE : TipoDispositivo.WEB;
}
