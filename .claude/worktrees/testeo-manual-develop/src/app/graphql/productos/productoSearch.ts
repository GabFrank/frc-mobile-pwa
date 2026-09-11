import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Producto } from 'src/app/domains/productos/producto.model';
import { productoSearchQuery } from './graphql-query';

export interface Response {
  data?: Producto[];
}

@Injectable({ providedIn: 'root' })
export class ProductoSearchGQL extends Query<Response> {
  document = productoSearchQuery;
}
