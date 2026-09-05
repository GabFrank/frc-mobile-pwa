import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { deleteDevolucionItemMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeleteDevolucionItemGQL extends Mutation<Response> {
  document = deleteDevolucionItemMutation;
}
