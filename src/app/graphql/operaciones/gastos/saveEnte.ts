import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { Ente } from 'src/app/domains/gastos/ente.model';
import { saveEnteMutation } from './graphql-query';

export interface Response {
  data?: Ente;
}

@Injectable({ providedIn: 'root' })
export class SaveEnteGQL extends Mutation<Response> {
  document = saveEnteMutation;
}
