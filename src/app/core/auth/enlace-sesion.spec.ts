import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AUTH_TOKEN_KEY,
  guardarBandera,
  guardarSesion,
  MANTENER_CONECTADO_KEY,
} from './auth.tokens';
import { contextoConSesion } from './enlace-sesion';

describe('contextoConSesion', () => {
  const limpiar = () => {
    localStorage.clear();
    sessionStorage.clear();
  };

  beforeEach(limpiar);
  // Los specs comparten almacenamiento y `sessionStorage` tiene prioridad al
  // leer: un token olvidado acá contamina a los demás archivos.
  afterEach(limpiar);

  const autorizacion = (contexto: Record<string, unknown>) =>
    (contexto['headers'] as Record<string, string> | undefined)?.['Authorization'];

  it('manda el token con «mantenerme conectado» prendido', () => {
    guardarBandera(MANTENER_CONECTADO_KEY, true);
    guardarSesion('abc', 7);

    expect(autorizacion(contextoConSesion({}))).toBe('Token abc');
  });

  it('manda el token con «mantenerme conectado» apagado', () => {
    // El token vive en `sessionStorage`. Cuando el link leía solo
    // `localStorage`, la query de sesión salía sin credencial y el login
    // terminaba en 401 con la contraseña correcta.
    guardarBandera(MANTENER_CONECTADO_KEY, false);
    guardarSesion('abc', 7);

    expect(autorizacion(contextoConSesion({}))).toBe('Token abc');
  });

  it('no agrega el encabezado sin sesión', () => {
    expect(contextoConSesion({})).toEqual({});
  });

  it('la cadena "null" heredada no cuenta como token', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'null');

    expect(autorizacion(contextoConSesion({}))).toBeUndefined();
  });

  it('conserva los encabezados que ya traía la operación', () => {
    guardarSesion('abc', 7);

    const contexto = contextoConSesion({ headers: { 'X-Otro': '1' }, otra: true });

    expect(contexto['headers']).toEqual({ 'X-Otro': '1', Authorization: 'Token abc' });
    expect(contexto['otra']).toBe(true);
  });
});
