import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { pdvCajaDesdeFilialQuery } from './graphql-query';

export interface Response {
  data: PdvCaja;
}

@Injectable({
  providedIn: 'root',
})
export class PdvCajaDesdeFilialGQL extends Query<Response> {
  document = pdvCajaDesdeFilialQuery;
}
