import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Zona } from '../zona.model';
import { zonasQuery } from './graphql-query';

export interface Response {
  data?: Zona[];
}

@Injectable({
  providedIn: 'root',
})
export class ZonasGQL extends Query<{ data?: Zona[] }> {
  document = zonasQuery;
}
