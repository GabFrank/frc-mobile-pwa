import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { reabrirRecepcionMutation } from './graphql-query';

export interface Response {
  data?: RecepcionMercaderia;
}

@Injectable({ providedIn: 'root' })
export class ReabrirRecepcionGQL extends Mutation<Response> {
  document = reabrirRecepcionMutation;
}
