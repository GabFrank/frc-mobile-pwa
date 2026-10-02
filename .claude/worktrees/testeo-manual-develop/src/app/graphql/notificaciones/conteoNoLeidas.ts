import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { conteoNoLeidasQuery } from './graphql-query';

export interface Response {
  data?: number;
}

@Injectable({ providedIn: 'root' })
export class ConteoNoLeidasGQL extends Query<Response> {
  document = conteoNoLeidasQuery;
}
