import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PedidosParaFactura } from 'src/app/domains/compras/compras.model';
import { pedidosParaFacturaQuery } from './graphql-query';

export interface Response {
  data?: PedidosParaFactura;
}

@Injectable({ providedIn: 'root' })
export class PedidosParaFacturaGQL extends Query<Response> {
  document = pedidosParaFacturaQuery;
}
