import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { deletePrecioPorSucursalMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeletePrecioPorSucursalGQL extends Mutation<Response> {
  document = deletePrecioPorSucursalMutation;
}
