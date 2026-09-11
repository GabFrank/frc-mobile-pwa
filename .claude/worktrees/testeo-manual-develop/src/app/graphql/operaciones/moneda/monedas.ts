import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import { monedasQuery } from './graphql-query';

export interface Response {
  data?: Moneda[];
}

@Injectable({ providedIn: 'root' })
export class MonedasGQL extends Query<Response> {
  document = monedasQuery;
}
