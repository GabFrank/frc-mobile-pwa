import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { productoStockQuery } from './graphql-query';

export interface Response {
  data?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductoStockGQL extends Query<Response> {
  document = productoStockQuery;
}
