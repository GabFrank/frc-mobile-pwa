import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { marcarNotificacionLeidaMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarcarNotificacionLeidaGQL extends Mutation<Response> {
  document = marcarNotificacionLeidaMutation;
}
