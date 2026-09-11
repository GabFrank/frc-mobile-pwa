import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { confirmarRetiroMutation } from './graphql-query';

export interface Response {
  data?: PreGasto;
}

@Injectable({ providedIn: 'root' })
export class ConfirmarRetiroGQL extends Mutation<Response> {
  document = confirmarRetiroMutation;
}
