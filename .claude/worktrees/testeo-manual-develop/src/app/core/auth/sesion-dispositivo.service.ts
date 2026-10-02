import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { InicioSesion } from 'src/app/domains/configuracion/inicio-sesion.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { SaveInicioSesionGQL } from 'src/app/graphql/personas/usuario/graphql/saveInicioSesion';
import { DatosService } from '../graphql/datos.service';
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

    // Reusar la fila si el central ya devolvió una de **este mismo** aparato:
    // si no, cada arranque deja una sesión abierta más y el fallback del
    // central tiene cada vez más filas entre las que elegir mal.
    const previa = usuario.inicioSesion;
    if (previa?.id != null && previa.idDispositivo === idDispositivo) {
      sesion.id = previa.id;
      sesion.horaInicio = previa.horaInicio ? new Date(previa.horaInicio) : new Date();
      // El token vive en la fila: no pisarlo con vacío al reabrir la sesión,
      // o el push deja de llegar hasta que alguien vuelva a activarlo.
      sesion.token = previa.token;
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
    }
  }
}
