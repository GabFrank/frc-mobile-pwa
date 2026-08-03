import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { actualizarTokenFcmGQL } from './graphql-query';

export interface ActualizarTokenFcmResponse {
  data?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ActualizarTokenFcmGQL extends Mutation<{ data?: ActualizarTokenFcmResponse }> {
  document = actualizarTokenFcmGQL;
}
