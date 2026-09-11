import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';

import { savePresentacionMutation } from './graphql-query';

export interface Response {
  data?: Presentacion;
}

@Injectable({ providedIn: 'root' })
export class SavePresentacionGQL extends Mutation<Response> {
  document = savePresentacionMutation;
}
