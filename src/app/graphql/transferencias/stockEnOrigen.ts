import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { stockEnOrigenQuery } from './graphql-query';

export interface Response {
  data?: number;
}

@Injectable({ providedIn: 'root' })
export class StockEnOrigenGQL extends Query<Response> {
  document = stockEnOrigenQuery;
}
