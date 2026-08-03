import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { cerrarCajaDesdeServidorQuery } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class CerrarCajaGQL extends Mutation<{ data?: boolean }> {
  document = cerrarCajaDesdeServidorQuery;
}
