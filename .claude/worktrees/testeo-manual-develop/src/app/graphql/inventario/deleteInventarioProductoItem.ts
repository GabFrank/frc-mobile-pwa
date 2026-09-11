import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { deleteInventarioProductoItemMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeleteInventarioProductoItemGQL extends Mutation<Response> {
  document = deleteInventarioProductoItemMutation;
}
