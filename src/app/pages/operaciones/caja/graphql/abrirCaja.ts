import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { CajaFilialOperacionResult } from 'src/app/domains/caja/caja.model';
import { abrirCajaDesdeServidorQuery } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class AbrirCajaGQL extends Mutation<{ data?: CajaFilialOperacionResult }> {
  document = abrirCajaDesdeServidorQuery;
}
