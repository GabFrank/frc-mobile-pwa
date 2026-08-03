import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { generateUUID } from 'src/app/generic/utils/string-utils';
import { ServerConfigService } from '../config/server-config.service';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_ID_KEY,
  DEVICE_ID_KEY,
  hayTokenEnSesion,
  leerUsuarioIdEnSesion,
} from './auth.tokens';

interface RespuestaLogin {
  token?: string;
  usuarioId?: number;
  sucursal?: Sucursal;
  message?: string;
  mensaje?: string;
}

export interface ResultadoLogin {
  ok: boolean;
  /** Mensaje listo para mostrar. Vacío si `ok`. */
  mensaje?: string;
  /** El backend obliga a cambiar la contraseña por defecto. */
  requiereCambioContrasena?: boolean;
}

/** Contraseña con la que se dan de alta los usuarios. */
const CONTRASENA_POR_DEFECTO = '123';

/**
 * Autenticación.
 *
 * El login **no** usa GraphQL: es REST contra el central. Ver
 * `docs/arquitectura/autenticacion-sesion.md`.
 *
 * Diferencias con `frc-mobile`:
 * · Al cerrar sesión se usa `removeItem`, no `setItem(clave, null)` — aquello
 *   persistía la cadena `"null"` y obligaba a chequeos defensivos en todo el
 *   código (TODO_TECNICO #4).
 * · El estado de sesión es un signal, no un `BehaviorSubject<boolean>`
 *   inicializado en `null`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly serverConfig = inject(ServerConfigService);

  private readonly _usuario = signal<Usuario | null>(null);
  private readonly _sucursal = signal<Sucursal | null>(null);

  readonly usuario = this._usuario.asReadonly();
  readonly sucursal = this._sucursal.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly roles = computed(() => this._usuario()?.roles ?? []);

  /** Hay token guardado: puede haber sesión que restaurar. */
  get hayTokenGuardado(): boolean {
    return hayTokenEnSesion();
  }

  get usuarioIdGuardado(): number | null {
    return leerUsuarioIdEnSesion();
  }

  /** Identificador estable de esta instalación. */
  get deviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id === 'null') {
      id = generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  async login(nickname: string, password: string): Promise<ResultadoLogin> {
    try {
      const res = await firstValueFrom(
        this.http.post<RespuestaLogin>(this.serverConfig.loginUrl, { nickname, password }),
      );

      if (!res?.token || res.usuarioId == null) {
        return { ok: false, mensaje: this.mensajeCredenciales(res?.message ?? res?.mensaje) };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      localStorage.setItem(AUTH_USER_ID_KEY, String(res.usuarioId));
      this._sucursal.set(res.sucursal ?? null);

      return {
        ok: true,
        // El chequeo es literal contra la contraseña de alta: fuerza el
        // cambio en el primer ingreso. No es una marca del backend.
        requiereCambioContrasena: password === CONTRASENA_POR_DEFECTO,
      };
    } catch (error) {
      return { ok: false, mensaje: this.traducirError(error) };
    }
  }

  /** Publica el usuario ya resuelto por GraphQL tras el login o al restaurar. */
  establecerUsuario(usuario: Usuario | null): void {
    this._usuario.set(usuario);
    if (usuario?.sucursal) {
      this._sucursal.set(usuario.sucursal);
    }
  }

  async logout(navegar = true): Promise<void> {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_ID_KEY);
    this._usuario.set(null);
    this._sucursal.set(null);
    if (navegar) {
      await this.router.navigate(['/login']);
    }
  }

  /**
   * Traduce el fallo HTTP a algo que el usuario pueda accionar.
   *
   * La distinción importa: en una sucursal, "contraseña incorrecta" y
   * "servidor caído" llevan a acciones distintas.
   */
  private traducirError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo iniciar sesión. Intentá de nuevo.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verificá la conexión y la configuración.';
    }
    if (error.status === 401 || error.status === 403) {
      return this.mensajeCredenciales();
    }

    const delServidor = String(
      (error.error as RespuestaLogin | undefined)?.message ??
        (error.error as RespuestaLogin | undefined)?.mensaje ??
        '',
    ).toLowerCase();

    if (
      ['contrase', 'credencial', 'bad credential', 'usuario no existe', 'unauthorized'].some(
        (p) => delServidor.includes(p),
      )
    ) {
      return this.mensajeCredenciales();
    }
    return 'El servidor rechazó el inicio de sesión. Intentá de nuevo o avisá a sistemas.';
  }

  private mensajeCredenciales(delServidor?: string): string {
    return delServidor?.trim()
      ? delServidor
      : 'Usuario o contraseña incorrectos. Verificá e intentá de nuevo.';
  }
}
