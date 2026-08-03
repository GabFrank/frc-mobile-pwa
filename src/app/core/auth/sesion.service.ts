import { inject, Injectable } from '@angular/core';
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
    try {
      const usuario = await firstValueFrom(
        this.datos.porId<Usuario>(this.usuarioLoginGQL, usuarioId, undefined, {
          mostrarCarga: false,
          notificarError: false,
        }),
      );
      if (!usuario?.id) {
        return false;
      }
      this.auth.establecerUsuario(usuario);
      return true;
    } catch {
      return false;
    }
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
