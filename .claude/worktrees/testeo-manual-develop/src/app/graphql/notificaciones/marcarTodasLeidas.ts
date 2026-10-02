import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { marcarTodasLeidasMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarcarTodasLeidasGQL extends Mutation<Response> {
  document = marcarTodasLeidasMutation;
}
