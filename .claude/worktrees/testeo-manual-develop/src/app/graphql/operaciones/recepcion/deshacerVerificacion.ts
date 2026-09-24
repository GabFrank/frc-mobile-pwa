import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { deshacerVerificacionMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeshacerVerificacionGQL extends Mutation<Response> {
  document = deshacerVerificacionMutation;
}
