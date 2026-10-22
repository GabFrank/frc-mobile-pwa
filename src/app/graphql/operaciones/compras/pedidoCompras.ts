import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { CompraPedido } from 'src/app/domains/compras/compras.model';
import { pedidoComprasQuery } from './graphql-query';

export interface Response {
  data?: CompraPedido;
}

@Injectable({ providedIn: 'root' })
export class PedidoComprasGQL extends Query<Response> {
  document = pedidoComprasQuery;
}
