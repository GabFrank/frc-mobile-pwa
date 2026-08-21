import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { cancelarInventarioMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CancelarInventarioGQL extends Mutation<Response> {
  document = cancelarInventarioMutation;
}
