import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import { saveInventarioMutation } from './graphql-query';

export interface Response {
  data?: Inventario;
}

@Injectable({ providedIn: 'root' })
export class SaveInventarioGQL extends Mutation<Response> {
  document = saveInventarioMutation;
}
