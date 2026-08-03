import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { abrirCajaDesdeServidorQuery } from './graphql-query';

export interface Response {
  data: Boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AbrirCajaGQL extends Mutation<{ data?: boolean }> {
  document = abrirCajaDesdeServidorQuery;
}
