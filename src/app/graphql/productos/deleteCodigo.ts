import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { deleteCodigoMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeleteCodigoGQL extends Mutation<Response> {
  document = deleteCodigoMutation;
}
