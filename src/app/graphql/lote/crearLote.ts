import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { Lote } from 'src/app/domains/lote/lote.model';
import { crearLoteMutation } from './graphql-query';

export interface Response {
  data?: Lote;
}

@Injectable({ providedIn: 'root' })
export class CrearLoteGQL extends Mutation<Response> {
  document = crearLoteMutation;
}
