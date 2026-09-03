import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { solicitarPushQuery } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SolicitarPushGQL extends Query<Response> {
  document = solicitarPushQuery;
}
