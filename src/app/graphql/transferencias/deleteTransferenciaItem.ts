import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { deleteTransferenciaItemMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeleteTransferenciaItemGQL extends Mutation<Response> {
  document = deleteTransferenciaItemMutation;
}
