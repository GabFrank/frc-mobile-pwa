import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PaginaNotificaciones } from 'src/app/pages/notificaciones/notificacion.service';
import { notificacionesUsuarioQuery } from './graphql-query';

export interface Response {
  data?: PaginaNotificaciones;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesUsuarioGQL extends Query<Response> {
  document = notificacionesUsuarioQuery;
}
