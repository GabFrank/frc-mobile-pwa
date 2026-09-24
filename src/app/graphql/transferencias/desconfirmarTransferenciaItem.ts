import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { TransferenciaItem } from 'src/app/domains/transferencia/transferencia.model';

import { desconfirmarTransferenciaItemMutation } from './graphql-query';

export interface Response {
  data?: TransferenciaItem;
}

@Injectable({ providedIn: 'root' })
export class DesconfirmarTransferenciaItemGQL extends Mutation<Response> {
  document = desconfirmarTransferenciaItemMutation;
}
