import { CONTRASENA_POR_DEFECTO } from 'src/app/core/auth/auth.service';
import type { UsuarioParaCambioClave } from 'src/app/graphql/personas/usuario/graphql/usuarioParaCambioClave';

/** El tope del central al restablecer (`RecuperacionContrasenaService.validarContrasena`). */
export const LARGO_MAXIMO = 50;

/**
 * Mensaje para mostrar, o `null` si se puede guardar.
 *
 * Las mismas reglas en Mi cuenta y en «¿Olvidaste tu contraseña?»: son las que
 * el central aplica al restablecer, más «distinta de 123». La cédula la
 * controla el central, que es quien la conoce.
 */
export function validarNuevaContrasena(nueva: string, repetida: string, nickname?: string): string | null {
  if (!nueva || !nueva.trim()) {
    return 'Escribí la contraseña nueva.';
  }
  if (nueva !== nueva.trim()) {
    // El login no recorta: un espacio al borde se guarda y después nadie lo recuerda.
    return 'Sin espacios al principio ni al final.';
  }
  if (nueva.length > LARGO_MAXIMO) {
    return `No puede superar los ${LARGO_MAXIMO} caracteres.`;
  }
  if (new Set(nueva).size === 1) {
    return 'No puede ser un mismo carácter repetido.';
  }
  if (nickname && nueva.toUpperCase() === nickname.trim().toUpperCase()) {
    return 'No puede ser igual a tu usuario.';
  }
  // Con la de alta el aviso del login seguiría saliendo.
  if (nueva === CONTRASENA_POR_DEFECTO) {
    return 'Elegí una distinta de la de alta.';
  }
  if (nueva !== repetida) {
    return 'Las dos contraseñas no coinciden.';
  }
  return null;
}

/**
 * `UsuarioInput` completo para `saveUsuario`.
 *
 * ⚠️ `usuarioId` es **el creador** del usuario, no quien guarda: va el que
 * vino del central. Por eso no se usa `DatosService.guardar`, que lo llena
 * con el usuario en sesión.
 */
export function inputCambioClave(usuario: UsuarioParaCambioClave, clave: string) {
  return {
    id: usuario.id,
    nickname: usuario.nickname,
    personaId: usuario.persona?.id ?? null,
    usuarioId: usuario.usuario?.id ?? null,
    activo: usuario.activo ?? null,
    password: clave,
  };
}
