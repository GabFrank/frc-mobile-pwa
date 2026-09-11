import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { transferenciaQrEscaneadoMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TransferenciaQrEscaneadoGQL extends Mutation<Response> {
  document = transferenciaQrEscaneadoMutation;
}
