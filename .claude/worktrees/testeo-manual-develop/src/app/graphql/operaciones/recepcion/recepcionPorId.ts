import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { recepcionPorIdQuery } from './graphql-query';

export interface Response {
  data?: RecepcionMercaderia;
}

@Injectable({ providedIn: 'root' })
export class RecepcionPorIdGQL extends Query<Response> {
  document = recepcionPorIdQuery;
}
