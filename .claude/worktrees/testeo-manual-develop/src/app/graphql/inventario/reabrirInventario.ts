import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { reabrirInventarioMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReabrirInventarioGQL extends Mutation<Response> {
  document = reabrirInventarioMutation;
}
