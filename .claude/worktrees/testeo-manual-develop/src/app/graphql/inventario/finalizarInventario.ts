import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import { finalizarInventarioMutation } from './graphql-query';

export interface Response {
  data?: Inventario;
}

@Injectable({ providedIn: 'root' })
export class FinalizarInventarioGQL extends Mutation<Response> {
  document = finalizarInventarioMutation;
}
