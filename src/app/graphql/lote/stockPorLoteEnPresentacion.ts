import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { StockLotePresentacion } from 'src/app/domains/lote/lote.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { stockPorLoteEnPresentacionQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<StockLotePresentacion>;
}

@Injectable({ providedIn: 'root' })
export class StockPorLoteEnPresentacionGQL extends Query<Response> {
  document = stockPorLoteEnPresentacionQuery;
}
