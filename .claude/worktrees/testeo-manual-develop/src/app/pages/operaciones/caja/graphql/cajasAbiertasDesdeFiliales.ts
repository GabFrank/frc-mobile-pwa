import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { cajasAbiertasDesdeFilialesQuery } from './graphql-query';

export interface Response {
  data: PdvCaja[];
}

@Injectable({
  providedIn: 'root',
})
export class CajasAbiertasDesdeFilialesGQL extends Query<Response> {
  document = cajasAbiertasDesdeFilialesQuery;
}
