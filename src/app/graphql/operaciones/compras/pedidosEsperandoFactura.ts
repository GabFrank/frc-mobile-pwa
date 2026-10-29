import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { CompraPedidoResumen } from 'src/app/domains/compras/compras.model';
import { pedidosEsperandoFacturaQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<CompraPedidoResumen>;
}

@Injectable({ providedIn: 'root' })
export class PedidosEsperandoFacturaGQL extends Query<Response> {
  document = pedidosEsperandoFacturaQuery;
}
