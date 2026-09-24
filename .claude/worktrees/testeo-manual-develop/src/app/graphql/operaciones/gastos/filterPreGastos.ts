import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { filterPreGastosQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<PreGasto>;
}

@Injectable({ providedIn: 'root' })
export class FilterPreGastosGQL extends Query<Response> {
  document = filterPreGastosQuery;
}
