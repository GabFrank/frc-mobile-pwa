import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Usuario } from 'src/app/domains/personas/usuario.model';
import { UsuarioLoginGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioLogin';
import { DatosService } from '../graphql/datos.service';
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

    it('cierra la sesión si hay token pero el usuario no se puede cargar', async () => {
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: 42 });
      porId.mockReturnValue(throwError(() => new Error('401')));

      await sesion.restaurar();

      // Un token que no resuelve a un usuario deja la app en estado ambiguo.
      expect(auth.logout).toHaveBeenCalledWith(false);
    });

    it('cierra la sesión si hay token pero no id', async () => {
      Object.assign(auth, { hayTokenGuardado: true, usuarioIdGuardado: null });
      await sesion.restaurar();
      expect(auth.logout).toHaveBeenCalledWith(false);
    });
  });
});
