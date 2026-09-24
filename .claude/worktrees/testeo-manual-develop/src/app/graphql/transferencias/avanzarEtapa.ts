import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';

import { avanzarEtapaMutation } from './graphql-query';

export interface Response {
  data?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AvanzarEtapaGQL extends Mutation<Response> {
  document = avanzarEtapaMutation;
}
