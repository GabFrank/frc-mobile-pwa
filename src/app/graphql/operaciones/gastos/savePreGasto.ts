import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { savePreGastoMutation } from './graphql-query';

/** Lo que devuelve el alta: alcanza para navegar al detalle. */
export interface PreGastoCreado {
  id: number;
  sucursalId?: number;
}

export interface Response {
  data?: PreGastoCreado;
}

@Injectable({ providedIn: 'root' })
export class SavePreGastoGQL extends Mutation<Response> {
  document = savePreGastoMutation;
}
