import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { PedidoRecepcionProductoDto } from 'src/app/domains/pedidos/recepcion.model';
import { productosPorRecepcionQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<PedidoRecepcionProductoDto>;
}

@Injectable({ providedIn: 'root' })
export class ProductosPorRecepcionGQL extends Query<Response> {
  document = productosPorRecepcionQuery;
}
