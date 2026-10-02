import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { TipoGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { tipoGastosQuery } from './graphql-query';

export interface Response {
  data?: TipoGasto[];
}

@Injectable({ providedIn: 'root' })
export class TipoGastosGQL extends Query<Response> {
  document = tipoGastosQuery;
}
