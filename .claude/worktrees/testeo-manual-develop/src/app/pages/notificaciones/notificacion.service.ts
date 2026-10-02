import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  ConfiguracionNotificacion,
  FiltrosNotificacion,
  NotificacionComentario,
  NotificacionDestinatario,
} from 'src/app/domains/notificacion/notificacion.model';
import { ActualizarPreferenciaGQL } from 'src/app/graphql/notificaciones/actualizarPreferencia';
import { ComentariosNotificacionGQL } from 'src/app/graphql/notificaciones/comentariosNotificacion';
import { ConteoNoLeidasGQL } from 'src/app/graphql/notificaciones/conteoNoLeidas';
import { CrearComentarioGQL } from 'src/app/graphql/notificaciones/crearComentario';
import { MarcarNotificacionLeidaGQL } from 'src/app/graphql/notificaciones/marcarNotificacionLeida';
import { MarcarTodasLeidasGQL } from 'src/app/graphql/notificaciones/marcarTodasLeidas';
import { MisConfiguracionesGQL } from 'src/app/graphql/notificaciones/misConfiguraciones';
import { NotificacionesUsuarioGQL } from 'src/app/graphql/notificaciones/notificacionesUsuario';

/** La página que devuelve `notificacionesUsuario`. No es el `Page` de Spring. */
export interface PaginaNotificaciones {
  content?: NotificacionDestinatario[];
  totalElements?: number;
  totalPages?: number;
  pageNumber?: number;
  pageSize?: number;
}

/**
 * Notificaciones con hilo de comentarios.
 *
 * No son avisos de marketing: `VENTA_STOCK_CRITICO` y `DIFERENCIA_MALETIN`
 * señalan descuadres que alguien tiene que investigar, y por eso cada una
 * admite discusión.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly datos = inject(DatosService);
  private readonly listaGQL = inject(NotificacionesUsuarioGQL);
  private readonly leidaGQL = inject(MarcarNotificacionLeidaGQL);
  private readonly todasGQL = inject(MarcarTodasLeidasGQL);
  private readonly conteoGQL = inject(ConteoNoLeidasGQL);
  private readonly comentariosGQL = inject(ComentariosNotificacionGQL);
  private readonly crearComentarioGQL = inject(CrearComentarioGQL);
  private readonly configGQL = inject(MisConfiguracionesGQL);
  private readonly preferenciaGQL = inject(ActualizarPreferenciaGQL);

  private readonly _noLeidas = signal(0);
  /** Para el badge. Se actualiza solo al consultar o marcar. */
  readonly noLeidas = this._noLeidas.asReadonly();

  lista(filtros: FiltrosNotificacion = {}): Observable<PaginaNotificaciones> {
    return this.datos.consultar<PaginaNotificaciones>(this.listaGQL, {
      leidas: filtros.leidas ?? null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 15,
      estadoTablero: filtros.estadoTablero ?? null,
      fechaInicio: filtros.fechaInicio ?? null,
      fechaFin: filtros.fechaFin ?? null,
    });
  }

  /**
   * ⚠️ Marca leída **para el usuario actual**, no para todos: la lectura vive
   * en el destinatario, y una notificación mandada a cinco usuarios tiene
   * cinco registros.
   */
  marcarLeida(notificacionId: number): Observable<boolean> {
    return this.datos
      .mutar<boolean>(this.leidaGQL, { notificacionId })
      .pipe(tap(() => this._noLeidas.update((n) => Math.max(0, n - 1))));
  }

  marcarTodasLeidas(): Observable<boolean> {
    return this.datos
      .mutar<boolean>(this.todasGQL, undefined, { mensajeExito: 'Todas marcadas como leídas' })
      .pipe(tap(() => this._noLeidas.set(0)));
  }

  /**
   * Vuelve a preguntarle al backend cuántas quedan sin leer.
   *
   * ⚠️ **No confundir con poner el contador en cero.** `frc-mobile` tenía las
   * dos cosas —`refrescarConteoNoLeidas` y `resetConteoNoLeidas`— y usar una
   * por la otra dejaba el badge desincronizado hasta la próxima consulta.
   * Acá solo existe la que consulta; el cero lo pone `marcarTodasLeidas`,
   * que además sabe que es verdad.
   */
  refrescarConteo(): Observable<number> {
    return this.datos
      .consultar<number>(this.conteoGQL, undefined, {
        mostrarCarga: false,
        notificarError: false,
      })
      .pipe(
        map((n) => n ?? 0),
        tap((n) => this._noLeidas.set(n)),
      );
  }

  comentarios(notificacionId: number): Observable<NotificacionComentario[]> {
    return this.datos
      .consultar<NotificacionComentario[]>(this.comentariosGQL, { notificacionId })
      .pipe(map((lista) => lista ?? []));
  }

  comentar(
    notificacionId: number,
    comentario: string,
    comentarioPadreId?: number,
    mediaUrl?: string,
  ): Observable<NotificacionComentario> {
    return this.datos.mutar<NotificacionComentario>(this.crearComentarioGQL, {
      notificacionId,
      comentario,
      comentarioPadreId: comentarioPadreId ?? null,
      mediaUrl: mediaUrl ?? null,
    });
  }

  configuraciones(): Observable<ConfiguracionNotificacion[]> {
    return this.datos
      .consultar<ConfiguracionNotificacion[]>(this.configGQL)
      .pipe(map((lista) => lista ?? []));
  }

  cambiarPreferencia(tipoNotificacion: string, habilitado: boolean): Observable<boolean> {
    return this.datos.mutar<boolean>(this.preferenciaGQL, { tipoNotificacion, habilitado });
  }
}
