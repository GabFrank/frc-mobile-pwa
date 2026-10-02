import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { NotificacionComentario } from 'src/app/domains/notificacion/notificacion.model';
import { crearComentarioMutation } from './graphql-query';

export interface Response {
  data?: NotificacionComentario;
}

@Injectable({ providedIn: 'root' })
export class CrearComentarioGQL extends Mutation<Response> {
  document = crearComentarioMutation;
}
