import { CONTRASENA_POR_DEFECTO } from 'src/app/core/auth/auth.service';
import type { UsuarioParaCambioClave } from 'src/app/graphql/personas/usuario/graphql/usuarioParaCambioClave';

/** Mismo mínimo que `frc-mobile`. */
export const LARGO_MINIMO = 3;

/** Mensaje para mostrar, o `null` si se puede guardar. */
export function validarNuevaContrasena(nueva: string, repetida: string): string | null {
  if (!nueva) {
    return 'Escribí la contraseña nueva.';
  }
  if (nueva !== nueva.trim()) {
    // El login no recorta: un espacio al borde se guarda y después nadie lo recuerda.
    return 'Sin espacios al principio ni al final.';
  }
  if (nueva.length < LARGO_MINIMO) {
    return `Tiene que tener al menos ${LARGO_MINIMO} caracteres.`;
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
