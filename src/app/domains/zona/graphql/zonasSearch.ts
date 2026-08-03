import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Zona } from '../zona.model';
import { zonasSearch } from './graphql-query';

export interface Response {
  data?: Zona[];
}


@Injectable({
  providedIn: 'root',
})
export class ZonasSearchGQL extends Query<Response> {
  document = zonasSearch;
}
