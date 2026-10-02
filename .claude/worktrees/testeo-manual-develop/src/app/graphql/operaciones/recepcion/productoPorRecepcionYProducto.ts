import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PedidoRecepcionProductoDto } from 'src/app/domains/pedidos/recepcion.model';
import { productoPorRecepcionYProductoQuery } from './graphql-query';

export interface Response {
  data?: PedidoRecepcionProductoDto;
}

@Injectable({ providedIn: 'root' })
export class ProductoPorRecepcionYProductoGQL extends Query<Response> {
  document = productoPorRecepcionYProductoQuery;
}
