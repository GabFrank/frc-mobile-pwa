import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { NotificacionComentario } from 'src/app/domains/notificacion/notificacion.model';
import { comentariosNotificacionQuery } from './graphql-query';

export interface Response {
  data?: NotificacionComentario[];
}

@Injectable({ providedIn: 'root' })
export class ComentariosNotificacionGQL extends Query<Response> {
  document = comentariosNotificacionQuery;
}
