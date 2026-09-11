import { beforeEach, describe, expect, it } from 'vitest';

import {
  AUTH_TOKEN_KEY,
  AUTH_USER_ID_KEY,
  guardarBandera,
  guardarSesion,
  guardarUsuarioRecordado,
  hayTokenEnSesion,
  leerBandera,
  leerUsuarioIdEnSesion,
  leerUsuarioRecordado,
  limpiarSesion,
  MANTENER_CONECTADO_KEY,
  mantenerConectado,
  RECORDAR_USUARIO_KEY,
} from '../core/auth/auth.tokens';

describe('Recordar usuario y mantener la sesión', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('valores por defecto', () => {
    it('arranca con las dos opciones activadas', () => {
      expect(leerBandera(RECORDAR_USUARIO_KEY)).toBe(true);
      expect(mantenerConectado()).toBe(true);
    });

    /*
      Con un default en `true`, borrar la clave equivale a volver a
      activarla. Si al apagar la opción se borrara en vez de guardar
      `'false'`, el usuario que pidió NO quedar conectado se lo encontraría
      prendido de nuevo en el siguiente arranque.
    */
    it('recuerda que la opción fue apagada', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, false);
      expect(mantenerConectado()).toBe(false);
      expect(localStorage.getItem(MANTENER_CONECTADO_KEY)).toBe('false');
    });
  });

  describe('dónde vive la sesión', () => {
    it('con "mantenerme conectado" sobrevive al cierre del navegador', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, true);
      guardarSesion('tok-123', 7);

      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok-123');
      expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    });

    it('sin ella, la sesión muere con la pestaña', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, false);
      guardarSesion('tok-123', 7);

      expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok-123');
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    });

    it('se lee de donde esté, sin importar la preferencia actual', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, false);
      guardarSesion('tok-123', 7);
      // El usuario cambia la preferencia sin volver a entrar.
      guardarBandera(MANTENER_CONECTADO_KEY, true);

      expect(hayTokenEnSesion()).toBe(true);
      expect(leerUsuarioIdEnSesion()).toBe(7);
    });

    /*
      Si al cambiar la preferencia quedara la sesión vieja en el otro
      almacén, `leerDeCualquierAlmacen` podría devolver el token anterior
      —el de otro usuario, si se cambió de cuenta—.
    */
    it('no deja una sesión huérfana al cambiar de almacén', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, false);
      guardarSesion('tok-viejo', 7);

      guardarBandera(MANTENER_CONECTADO_KEY, true);
      guardarSesion('tok-nuevo', 9);

      expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok-nuevo');
      expect(leerUsuarioIdEnSesion()).toBe(9);
    });

    it('cerrar sesión limpia los dos almacenes', () => {
      guardarBandera(MANTENER_CONECTADO_KEY, true);
      guardarSesion('tok-123', 7);
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'resto-viejo');

      limpiarSesion();

      expect(hayTokenEnSesion()).toBe(false);
      expect(leerUsuarioIdEnSesion()).toBeNull();
      expect(localStorage.getItem(AUTH_USER_ID_KEY)).toBeNull();
    });
  });

  describe('usuario recordado', () => {
    it('guarda el nombre y lo devuelve', () => {
      guardarUsuarioRecordado('gabriel', true);
      expect(leerUsuarioRecordado()).toBe('gabriel');
    });

    it('no lo devuelve si la opción está apagada', () => {
      guardarUsuarioRecordado('gabriel', false);
      expect(leerUsuarioRecordado()).toBeNull();
    });

    /*
      Recordar el nombre es una preferencia del dispositivo, no parte de la
      sesión: si `logout` lo borrara, habría que reescribirlo cada vez que
      el cajero sale.
    */
    it('sobrevive a cerrar sesión', () => {
      guardarUsuarioRecordado('gabriel', true);
      guardarSesion('tok-123', 7);

      limpiarSesion();

      expect(leerUsuarioRecordado()).toBe('gabriel');
    });

    /*
      La contraseña NO se guarda. Es la única defensa contra que alguien con
      el teléfono desbloqueado en la mano entre al ERP, y en este sistema
      además viaja en claro dentro del JWT (ver REPORTE_VULNERABILIDADES).
    */
    it('nunca guarda nada que parezca una contraseña', () => {
      guardarUsuarioRecordado('gabriel', true);
      guardarSesion('tok-123', 7);

      const claves = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
      expect(claves.some((k) => /pass|clave|contrase/i.test(k))).toBe(false);
    });
  });
});
