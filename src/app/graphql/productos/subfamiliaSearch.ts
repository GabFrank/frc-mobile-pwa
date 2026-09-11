import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Subfamilia } from 'src/app/domains/productos/familia.model';

import { subfamiliaSearchQuery } from './graphql-query';

export interface Response {
  data?: { getContent?: Subfamilia[]; hasNext?: boolean };
}

@Injectable({ providedIn: 'root' })
export class SubfamiliaSearchGQL extends Query<Response> {
  document = subfamiliaSearchQuery;
}
