import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Codigo } from 'src/app/domains/productos/codigo.model';

import { saveCodigoMutation } from './graphql-query';

export interface Response {
  data?: Codigo;
}

@Injectable({ providedIn: 'root' })
export class SaveCodigoGQL extends Mutation<Response> {
  document = saveCodigoMutation;
}
