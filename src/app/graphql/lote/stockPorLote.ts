import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { StockLote } from 'src/app/domains/lote/lote.model';
import { stockPorLoteQuery } from './graphql-query';

export interface Response {
  data?: StockLote[];
}

@Injectable({ providedIn: 'root' })
export class StockPorLoteGQL extends Query<Response> {
  document = stockPorLoteQuery;
}
