import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Familia } from 'src/app/domains/productos/familia.model';

import { familiaSearchQuery } from './graphql-query';

export interface Response {
  data?: { getContent?: Familia[]; hasNext?: boolean };
}

@Injectable({ providedIn: 'root' })
export class FamiliaSearchGQL extends Query<Response> {
  document = familiaSearchQuery;
}
