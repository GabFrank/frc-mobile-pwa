import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveGastoRendicionMutation } from './graphql-query';

export interface GastoRendicion {
  id?: number;
  montoTotal?: number;
  creadoEn?: string;
}

export interface Response {
  data?: GastoRendicion;
}

@Injectable({ providedIn: 'root' })
export class SaveGastoRendicionGQL extends Mutation<Response> {
  document = saveGastoRendicionMutation;
}
