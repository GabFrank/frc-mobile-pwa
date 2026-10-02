import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { stockPorSucursalesQuery } from './graphql-query';

export interface StockPorSucursal {
  sucursalId?: number | string;
  cantidad?: number;
}

export interface Response {
  data?: StockPorSucursal[];
}

@Injectable({ providedIn: 'root' })
export class StockPorSucursalesGQL extends Query<Response> {
  document = stockPorSucursalesQuery;
}
