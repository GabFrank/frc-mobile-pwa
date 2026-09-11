import { Injectable } from '@angular/core';
import { Mutation, Query } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { savePdvCaja } from './graphql-query';

export interface Response {
  data: PdvCaja;
}

@Injectable({
  providedIn: 'root',
})
export class SaveCajaGQL extends Mutation<Response> {
  document = savePdvCaja;
}
