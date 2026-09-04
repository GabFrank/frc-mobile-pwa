import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { finalizarTransferenciaMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FinalizarTransferenciaGQL extends Mutation<Response> {
  document = finalizarTransferenciaMutation;
}
