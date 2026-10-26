import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { InicioSesion } from 'src/app/domains/configuracion/inicio-sesion.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { PageInfo } from 'src/app/domains/page-info.model';
import { InicioSesionListPorUsuarioIdAndAbiertoGQL } from 'src/app/graphql/personas/usuario/graphql/inicioSesionPorUsuarioIdAndAbierto';
import { SaveInicioSesionGQL } from 'src/app/graphql/personas/usuario/graphql/saveInicioSesion';
import { DatosService } from '../graphql/datos.service';
import { PushService } from '../notificaciones/push.service';
import { idDeDispositivo, tipoDeDispositivo } from './dispositivo';

/**
 * Deja registrado que **este aparato** tiene una sesión abierta.
 *
 * ⚠️ **Sin esto, el push le llega al dispositivo equivocado.** El central
 * resuelve `actualizarTokenFcm` buscando la sesión activa por
 * `(usuario, idDispositivo)`; si no la encuentra, escribe el token en *la
 * primera sesión abierta del usuario*. Verificado contra la base: el token de
 * un Chrome de escritorio terminó escrito sobre una fila `WEB` de otro
 * navegador, y con otro orden de filas habría caído sobre la sesión **IOS**
 * del mismo usuario — el iPhone dejando de recibir avisos sin que nadie
 * toque nada.
 *
 * `frc-mobile` registra la sesión al entrar (`login.service.ts` →
 * `registrarSesionActiva`) y recién después sincroniza el token. La PWA se
 * había quedado con la segunda mitad.
 *
 * ⚠️ **Nunca rompe el login.** Si el registro falla —el central viejo, la red
 * corta— se anota en consola y la sesión sigue. Quedarse afuera de la app
 * porque no se pudo anotar un id de dispositivo sería una cura peor.
 */
@Injectable({ providedIn: 'root' })
export class SesionDispositivoService {
  private readonly datos = inject(DatosService);
  private readonly guardarGQL = inject(SaveInicioSesionGQL);
  private readonly abiertasGQL = inject(InicioSesionListPorUsuarioIdAndAbiertoGQL);
  private readonly push = inject(PushService);

  async registrar(usuario: Usuario | null): Promise<void> {
    if (usuario?.id == null) {
      return;
    }
    const idDispositivo = idDeDispositivo();
    const sesion = new InicioSesion();
    sesion.usuario = usuario;
    sesion.sucursal = usuario.inicioSesion?.sucursal;
    sesion.idDispositivo = idDispositivo;
    sesion.tipoDespositivo = tipoDeDispositivo();
    sesion.horaInicio = new Date();
    sesion.creadoEn = new Date();

    // Reusar la fila si **este mismo** aparato ya tiene una abierta: si no,
    // cada arranque abre otra, el central cierra la anterior y le borra el
    // token, y el push deja de llegar sin ningún error.
    const propia = await this.sesionAbiertaDeEsteAparato(usuario, idDispositivo);
    if (propia?.id != null) {
      sesion.id = propia.id;
      // La clave de inicio_sesion es (id, sucursal_id): el id de una fila con
      // la sucursal de otra no la reusa, crea una nueva.
      sesion.sucursal = propia.sucursal ?? sesion.sucursal;
      sesion.horaInicio = propia.horaInicio ? new Date(propia.horaInicio) : new Date();
      sesion.creadoEn = propia.creadoEn ? new Date(propia.creadoEn) : sesion.creadoEn;
      // El token vive en la fila: no pisarlo con vacío al reabrir la sesión.
      sesion.token = propia.token;
    }

    try {
      await firstValueFrom(
        this.datos.mutar<InicioSesion>(this.guardarGQL, { entity: sesion.toInput() }, {
          mostrarCarga: false,
          notificarError: false,
          mensajeExito: undefined,
        }),
      );
    } catch (error) {
      console.warn('[sesión] No se pudo registrar el dispositivo:', error);
      // Sin la fila de este aparato el central escribe el token en la primera
      // sesión abierta del usuario, que puede ser de otro aparato: mejor no
      // mandarlo.
      return;
    }

    await this.push.sincronizar();
  }

  /**
   * La sesión abierta de este aparato, si hay una.
   *
   * ⚠️ **`usuario.inicioSesion` no alcanza.** El central devuelve ahí la última
   * sesión abierta del usuario **en cualquier aparato**. Quien usa también el
   * escritorio o la app Android casi nunca tiene ahí la de la PWA, y entonces
   * se abría una sesión nueva en cada arranque.
   */
  private async sesionAbiertaDeEsteAparato(
    usuario: Usuario,
    idDispositivo: string,
  ): Promise<InicioSesion | null> {
    const previa = usuario.inicioSesion;
    if (previa?.id != null && previa.idDispositivo === idDispositivo) {
      return previa;
    }
    try {
      const pagina = await firstValueFrom(
        this.datos.porId<PageInfo<InicioSesion>>(
          this.abiertasGQL,
          usuario.id!,
          { page: 0, size: 50 },
          { mostrarCarga: false, notificarError: false },
        ),
      );
      return pagina?.getContent?.find((s) => s.idDispositivo === idDispositivo && s.id != null) ?? null;
    } catch (error) {
      console.warn('[sesión] No se pudieron consultar las sesiones abiertas:', error);
      return null;
    }
  }
}
