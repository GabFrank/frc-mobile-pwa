import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { actualizarPreferenciaMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ActualizarPreferenciaGQL extends Mutation<Response> {
  document = actualizarPreferenciaMutation;
}
