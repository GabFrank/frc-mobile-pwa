import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { DevolucionItem } from 'src/app/domains/devolucion/devolucion.model';
import { saveDevolucionItemMutation } from './graphql-query';

export interface Response {
  data?: DevolucionItem;
}

@Injectable({ providedIn: 'root' })
export class SaveDevolucionItemGQL extends Mutation<Response> {
  document = saveDevolucionItemMutation;
}
