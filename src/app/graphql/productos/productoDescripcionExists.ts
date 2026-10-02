import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { productoDescripcionExistsQuery } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductoDescripcionExistsGQL extends Query<Response> {
  document = productoDescripcionExistsQuery;
}
