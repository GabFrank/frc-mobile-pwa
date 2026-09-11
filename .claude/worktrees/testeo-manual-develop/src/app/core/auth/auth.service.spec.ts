import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Usuario } from 'src/app/domains/personas/usuario.model';
import { AuthService } from './auth.service';
import { AUTH_TOKEN_KEY, AUTH_USER_ID_KEY, DEVICE_ID_KEY } from './auth.tokens';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  describe('login', () => {
    it('guarda token y usuarioId cuando el backend responde bien', async () => {
      const promesa = auth.login('mayala', 'secreta');
      http.expectOne((r) => r.url.endsWith('/login')).flush({
        token: 'abc123',
        usuarioId: 42,
        sucursal: { id: 1, nombre: 'Bodega' },
      });

      const res = await promesa;
      expect(res.ok).toBe(true);
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('abc123');
      expect(localStorage.getItem(AUTH_USER_ID_KEY)).toBe('42');
      expect(auth.sucursal()?.nombre).toBe('Bodega');
    });

    it('marca que hay que cambiar la contraseña por defecto', async () => {
      const promesa = auth.login('mayala', '123');
      http.expectOne((r) => r.url.endsWith('/login')).flush({ token: 't', usuarioId: 1 });
      expect((await promesa).requiereCambioContrasena).toBe(true);
    });

    it('no marca cambio si la contraseña no es la de alta', async () => {
      const promesa = auth.login('mayala', 'otra');
      http.expectOne((r) => r.url.endsWith('/login')).flush({ token: 't', usuarioId: 1 });
      expect((await promesa).requiereCambioContrasena).toBe(false);
    });

    it('distingue credenciales incorrectas de servidor caído', async () => {
      const p1 = auth.login('x', 'y');
      http.expectOne((r) => r.url.endsWith('/login')).flush(null, {
        status: 401,
        statusText: 'Unauthorized',
      });
      expect((await p1).mensaje).toContain('contraseña');

      const p2 = auth.login('x', 'y');
      http.expectOne((r) => r.url.endsWith('/login')).error(new ProgressEvent('error'), {
        status: 0,
        statusText: '',
      });
      // El operador tiene que saber si revisar su clave o avisar a sistemas.
      expect((await p2).mensaje).toContain('conectar');
    });

    it('no guarda nada si la respuesta viene sin token', async () => {
      const promesa = auth.login('x', 'y');
      http.expectOne((r) => r.url.endsWith('/login')).flush({ mensaje: 'Usuario no existe' });

      const res = await promesa;
      expect(res.ok).toBe(false);
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    });
  });

  describe('logout', () => {
    it('borra las claves en vez de persistir la cadena "null"', async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'abc');
      localStorage.setItem(AUTH_USER_ID_KEY, '42');

      await auth.logout(false);

      // El repo anterior hacía setItem(clave, null) y guardaba "null".
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(AUTH_USER_ID_KEY)).toBeNull();
      expect(auth.autenticado()).toBe(false);
    });
  });

  describe('lectura de sesión', () => {
    it('ignora la cadena "null" heredada', () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'null');
      localStorage.setItem(AUTH_USER_ID_KEY, 'null');
      expect(auth.hayTokenGuardado).toBe(false);
      expect(auth.usuarioIdGuardado).toBeNull();
    });

    it('ignora un usuarioId que no sea numérico', () => {
      localStorage.setItem(AUTH_USER_ID_KEY, 'abc');
      expect(auth.usuarioIdGuardado).toBeNull();
    });
  });

  describe('deviceId', () => {
    it('genera uno y lo conserva entre llamadas', () => {
      const primero = auth.deviceId;
      expect(primero).toBeTruthy();
      expect(auth.deviceId).toBe(primero);
      expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(primero);
    });
  });

  describe('roles', () => {
    it('devuelve lista vacía sin usuario, no undefined', () => {
      expect(auth.roles()).toEqual([]);
    });

    it('expone los roles del usuario publicado', () => {
      const usuario = Object.assign(new Usuario(), { id: 1, roles: ['ADMIN'] });
      auth.establecerUsuario(usuario);
      expect(auth.roles()).toEqual(['ADMIN']);
      expect(auth.autenticado()).toBe(true);
    });
  });
});
