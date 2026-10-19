import { SetContextLink } from '@apollo/client/link/context';

import { leerTokenEnSesion } from './auth.tokens';

type Contexto = Record<string, unknown>;

/**
 * Agrega `Authorization: Token <t>` al contexto de una operación.
 *
 * El token se lee con `leerTokenEnSesion()`, nunca con `localStorage` directo:
 * sin «mantenerme conectado» vive en `sessionStorage`, y un link que mire un
 * solo almacén manda la operación sin credencial. El central responde 401 y
 * el login falla con la contraseña correcta.
 *
 * ⚠️ El central espera `Token`, no `Bearer`.
 */
export function contextoConSesion(prevContext: Contexto): Contexto {
  const token = leerTokenEnSesion();
  if (!token) {
    return prevContext;
  }
  return {
    ...prevContext,
    headers: { ...(prevContext['headers'] as object | undefined), Authorization: `Token ${token}` },
  };
}

/** El link de Apollo que autentica cada operación con la sesión vigente. */
export function crearEnlaceDeSesion(): SetContextLink {
  return new SetContextLink(contextoConSesion);
}
