import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UsuarioLoginGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioLogin';
import { SesionDispositivoService } from './sesion-dispositivo.service';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { DatosService, esFalloDeTransporte } from '../graphql/datos.service';
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
/** Intentos de restauración ante fallos de red, incluido el primero. */
const REINTENTOS = 3;

/** Espera antes de cada reintento. Creciente: un arranque de servidor tarda. */
const ESPERA_MS = [400, 1200];

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Injectable({ providedIn: 'root' })
export class SesionService {
  /** Motivo del último fallo al cargar la sesión. Para mostrar y diagnosticar. */
  readonly ultimoError = signal<string | null>(null);

  /**
   * `true` si el último fallo fue de red, no de credenciales.
   *
   * La pantalla de login lo usa para decir "no se pudo contactar al
   * servidor" en vez de dejar al usuario pensando que su contraseña dejó de
   * servir.
   */
  readonly ultimoFalloFueDeRed = signal(false);

  private readonly datos = inject(DatosService);
  private readonly auth = inject(AuthService);
  private readonly usuarioLoginGQL = inject(UsuarioLoginGQL);
  private readonly sesionDispositivo = inject(SesionDispositivoService);

  /**
   * Trae el usuario y lo publica. Devuelve `true` si lo logró.
   *
   * Ante fallo cierra la sesión: quedarse con un token que no resuelve a un
   * usuario deja la app en un estado ambiguo.
   */
  async cargarUsuario(usuarioId: number): Promise<boolean> {
    this.ultimoError.set(null);
    this.ultimoFalloFueDeRed.set(false);
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
      // Sin await: el registro del dispositivo no puede demorar la entrada, y
      // si falla no cambia nada de lo que la persona puede hacer.
      void this.sesionDispositivo.registrar(usuario);
      return true;
    } catch (error) {
      this.ultimoFalloFueDeRed.set(esFalloDeTransporte(error));
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
   * Restaura la sesión al arrancar.
   *
   * ⚠️ **Un fallo de red no cierra la sesión.** Antes cualquier error
   * cerraba: bastaba que el central tardara un segundo de más al arrancar la
   * app —o un hipo de wifi en la sucursal— para que el cajero apareciera en
   * el login teniendo que escribir su contraseña otra vez, sin ninguna
   * explicación. Un token inválido sí hay que descartarlo; "no llegué al
   * servidor" no dice nada sobre el token.
   *
   * Ante un fallo de transporte se reintenta con espera creciente. Si aun
   * así no se llega, la sesión se cierra —quedarse con un token sin roles
   * deja la UI vacía sin decir por qué— pero el login muestra el motivo
   * real.
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

    for (let intento = 0; intento < REINTENTOS; intento++) {
      if (await this.cargarUsuario(usuarioId)) {
        return;
      }
      // Si el servidor respondió que la credencial no sirve, reintentar es
      // perder tiempo: la respuesta va a ser la misma.
      if (!this.ultimoFalloFueDeRed()) {
        break;
      }
      if (intento < REINTENTOS - 1) {
        await esperar(ESPERA_MS[intento]!);
      }
    }

    await this.auth.logout(false);
  }
}
