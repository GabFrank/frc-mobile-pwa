import { TestBed } from '@angular/core/testing';
import { ServerError } from '@apollo/client/errors';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Usuario } from 'src/app/domains/personas/usuario.model';
import { UsuarioLoginGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioLogin';
import { DatosService, ErrorDatos } from '../graphql/datos.service';
import { AuthService } from './auth.service';
import { AUTH_TOKEN_KEY, AUTH_USER_ID_KEY } from './auth.tokens';
import { SesionDispositivoService } from './sesion-dispositivo.service';
import { SesionService } from './sesion.service';

describe('SesionService', () => {
  let sesion: SesionService;
  let auth: AuthService;
  let porId: ReturnType<typeof vi.fn>;

  const usuario = Object.assign(new Usuario(), { id: 42, nickname: 'mayala', roles: ['ADMIN'] });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    porId = vi.fn(() => of(usuario));

    TestBed.configureTestingModule({
      providers: [
        SesionService,
        { provide: DatosService, useValue: { porId } },
        {
          provide: AuthService,
          useValue: {
            hayTokenGuardado: false,
            usuarioIdGuardado: null,
            establecerUsuario: vi.fn(),
            logout: vi.fn(() => Promise.resolve()),
          },
        },
        { provide: UsuarioLoginGQL, useValue: { document: {} } },
        // Registrar el dispositivo es un efecto lateral del login, no parte de
        // lo que se prueba acá. Se sustituye para que el spec no necesite
        // Apollo por la mutación de `saveInicioSesion`.
        { provide: SesionDispositivoService, useValue: { registrar: vi.fn(() => Promise.resolve()) } },
      ],
    });

    sesion = TestBed.inject(SesionService);
    auth = TestBed.inject(AuthService);
  });

  // Los timers falsos son globales y los specs comparten proceso: si un test
  // falla antes de devolverlos, el resto de la batería queda sin reloj.
  afterEach(() => vi.useRealTimers());

  /**
   * El error que entrega `DatosService` cuando el central contesta con ese
   * status: un `ErrorDatos` cuya causa es el `ServerError` de Apollo. No un
   * `new Error('503')`: la clasificación mira la causa, y un doble sin ella
   * prueba otra cosa.
   */
  const falloHttp = (status: number) =>
    throwError(() => {
      const mensaje = `Response not successful: Received status code ${status}`;
      const causa = new ServerError(mensaje, { response: { status } as Response, bodyText: '' });
      return new ErrorDatos(mensaje, causa);
    });

  describe('cargarUsuario', () => {
    it('publica el usuario en AuthService', async () => {
      expect(await sesion.cargarUsuario(42)).toBe(true);
      expect(auth.establecerUsuario).toHaveBeenCalledWith(usuario);
    });

    it('devuelve false si la consulta falla', async () => {
      porId.mockReturnValue(throwError(() => new Error('sin red')));
      expect(await sesion.cargarUsuario(42)).toBe(false);
      expect(auth.establecerUsuario).not.toHaveBeenCalled();
    });

    it('devuelve false si el backend no encuentra al usuario', async () => {
      porId.mockReturnValue(of(null));
      expect(await sesion.cargarUsuario(42)).toBe(false);
    });

    it('un 5xx es fallo de red; un 401 no', async () => {
      porId.mockReturnValue(falloHttp(503));
      await sesion.cargarUsuario(42);
      expect(sesion.ultimoFalloFueDeRed()).toBe(true);

      porId.mockReturnValue(falloHttp(401));
      await sesion.cargarUsuario(42);
      expect(sesion.ultimoFalloFueDeRed()).toBe(false);
    });

    it('con tope, si el servidor no contesta se rinde y lo cuenta como fallo de red', async () => {
      vi.useFakeTimers();
      porId.mockReturnValue(NEVER);

      const resultado = sesion.cargarUsuario(42, 10_000);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await resultado).toBe(false);
      expect(sesion.ultimoFalloFueDeRed()).toBe(true);
    });

    it('sin tope espera: al entrar, un central lento no es un central caído', async () => {
      vi.useFakeTimers();
      porId.mockReturnValue(NEVER);
      let termino = false;

      void sesion.cargarUsuario(42).then(() => (termino = true));
      await vi.advanceTimersByTimeAsync(60_000);

      expect(termino).toBe(false);
    });
  });

  describe('restaurar', () => {
    it('no hace nada si no hay token', async () => {
      await sesion.restaurar();
      expect(porId).not.toHaveBeenCalled();
    });

    it('carga el usuario cuando hay token e id', async () => {
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      await sesion.restaurar();
      expect(auth.establecerUsuario).toHaveBeenCalledWith(usuario);
    });

    it('cierra la sesión sin reintentar si el servidor rechaza la credencial', async () => {
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      porId.mockReturnValue(falloHttp(401));

      await sesion.restaurar();

      // Un token que no resuelve a un usuario deja la app en estado ambiguo,
      // y la respuesta no va a cambiar por volver a preguntar.
      expect(porId).toHaveBeenCalledTimes(1);
      expect(auth.logout).toHaveBeenCalledWith(false);
    });

    it('ante un 5xx reintenta, y no cierra la sesión si el central vuelve', async () => {
      vi.useFakeTimers();
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      porId
        .mockReturnValueOnce(falloHttp(503))
        .mockReturnValueOnce(falloHttp(502))
        .mockReturnValueOnce(of(usuario));

      const restauracion = sesion.restaurar();
      await vi.advanceTimersByTimeAsync(400 + 1200);
      await restauracion;

      expect(porId).toHaveBeenCalledTimes(3);
      expect(auth.establecerUsuario).toHaveBeenCalledWith(usuario);
      expect(auth.logout).not.toHaveBeenCalled();
    });

    it('cada intento de la restauración tiene un tope de 10 s', async () => {
      vi.useFakeTimers();
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      porId.mockReturnValue(NEVER);

      const restauracion = sesion.restaurar();
      await vi.advanceTimersByTimeAsync(3 * 10_000 + 400 + 1200);
      await restauracion;

      expect(porId).toHaveBeenCalledTimes(3);
      expect(auth.logout).toHaveBeenCalledWith(false);
    });

    it('si el central sigue caído tras tres intentos, cierra la sesión', async () => {
      vi.useFakeTimers();
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      porId.mockReturnValue(falloHttp(503));

      const restauracion = sesion.restaurar();
      await vi.advanceTimersByTimeAsync(400 + 1200);
      await restauracion;

      expect(porId).toHaveBeenCalledTimes(3);
      expect(auth.logout).toHaveBeenCalledWith(false);
      expect(sesion.ultimoFalloFueDeRed()).toBe(true);
    });

    it('cierra la sesión si hay token pero no id', async () => {
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: null });
      await sesion.restaurar();
      expect(auth.logout).toHaveBeenCalledWith(false);
    });
  });
});
