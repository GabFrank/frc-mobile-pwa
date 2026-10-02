import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { recepcionActivaPorNotaYSucursalQuery } from './graphql-query';

export interface Response {
  data?: RecepcionMercaderia;
}

@Injectable({ providedIn: 'root' })
export class RecepcionActivaPorNotaYSucursalGQL extends Query<Response> {
  document = recepcionActivaPorNotaYSucursalQuery;
}
