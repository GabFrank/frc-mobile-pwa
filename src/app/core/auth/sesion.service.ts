import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UsuarioLoginGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioLogin';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { DatosService } from '../graphql/datos.service';
import { AuthService } from './auth.service';

/**
 * Carga el `Usuario` completo y lo publica en `AuthService`.
 *
 * Existe porque el login REST solo devuelve `token`, `usuarioId` y
 * `sucursal`: los **roles** —de los que depende todo el control de acceso de
 * la UI— vienen de GraphQL.
 *
 * Se llama en dos momentos:
 *  1. después de un login exitoso;
 *  2. al arrancar la app, si hay token guardado (recarga de página).
 *
 * Sin el paso 2, recargar dejaba la sesión "válida" para el guard pero sin
 * identidad ni roles, y la UI ocultaba en silencio todo lo que depende de
 * ellos.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  /** Motivo del último fallo al cargar la sesión. Para mostrar y diagnosticar. */
  readonly ultimoError = signal<string | null>(null);

  private readonly datos = inject(DatosService);
  private readonly auth = inject(AuthService);
  private readonly usuarioLoginGQL = inject(UsuarioLoginGQL);

  /**
   * Trae el usuario y lo publica. Devuelve `true` si lo logró.
   *
   * Ante fallo cierra la sesión: quedarse con un token que no resuelve a un
   * usuario deja la app en un estado ambiguo.
   */
  async cargarUsuario(usuarioId: number): Promise<boolean> {
    this.ultimoError.set(null);
    try {
      const usuario = await firstValueFrom(
        this.datos.porId<Usuario>(this.usuarioLoginGQL, usuarioId, undefined, {
          mostrarCarga: false,
          notificarError: false,
        }),
      );
      if (!usuario?.id) {
        this.registrarFallo('El servidor no devolvió datos para este usuario.');
        return false;
      }
      this.auth.establecerUsuario(usuario);
      return true;
    } catch (error) {
      this.registrarFallo(
        error instanceof Error ? error.message : 'Error desconocido al cargar el usuario.',
      );
      return false;
    }
  }

  /**
   * Deja rastro del motivo del fallo.
   *
   * Sin esto, un error en la query de sesión se tragaba en silencio y la
   * pantalla solo decía "no se pudieron cargar tus datos", sin ninguna pista
   * de por qué — que fue exactamente lo que pasó cuando la query pedía un
   * campo inexistente en el schema del central.
   */
  private registrarFallo(mensaje: string): void {
    this.ultimoError.set(mensaje);
    console.error('[sesión] No se pudo cargar el usuario:', mensaje);
  }

  /**
   * Restaura la sesión al arrancar. Si el token guardado ya no sirve, la
   * cierra en silencio y el guard redirige al login.
   */
  async restaurar(): Promise<void> {
    if (!this.auth.hayTokenGuardado) {
      return;
    }
    const usuarioId = this.auth.usuarioIdGuardado;
    if (usuarioId == null) {
      await this.auth.logout(false);
      return;
    }
    const ok = await this.cargarUsuario(usuarioId);
    if (!ok) {
      await this.auth.logout(false);
    }
  }
}
