import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Producto } from 'src/app/domains/productos/producto.model';
import { productoPorIdQuery } from './graphql-query';

export interface Response {
  data?: Producto;
}

@Injectable({ providedIn: 'root' })
export class ProductoPorIdGQL extends Query<Response> {
  document = productoPorIdQuery;
}
