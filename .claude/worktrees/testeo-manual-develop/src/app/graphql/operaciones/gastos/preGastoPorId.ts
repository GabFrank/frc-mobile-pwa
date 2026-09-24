import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { preGastoPorIdQuery } from './graphql-query';

export interface Response {
  data?: PreGasto;
}

@Injectable({ providedIn: 'root' })
export class PreGastoPorIdGQL extends Query<Response> {
  document = preGastoPorIdQuery;
}
