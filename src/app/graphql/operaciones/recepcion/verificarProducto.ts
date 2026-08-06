import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { verificarProductoMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class VerificarProductoGQL extends Mutation<Response> {
  document = verificarProductoMutation;
}
