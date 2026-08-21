import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { finalizarRecepcionMutation } from './graphql-query';

export interface Response {
  data?: RecepcionMercaderia;
}

@Injectable({ providedIn: 'root' })
export class FinalizarRecepcionGQL extends Mutation<Response> {
  document = finalizarRecepcionMutation;
}
