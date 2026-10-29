import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PresentacionCompra } from 'src/app/domains/compras/compras.model';
import { presentacionesCompraQuery } from './graphql-query';

export interface Response {
  data?: PresentacionCompra[];
}

@Injectable({ providedIn: 'root' })
export class PresentacionesCompraGQL extends Query<Response> {
  document = presentacionesCompraQuery;
}
