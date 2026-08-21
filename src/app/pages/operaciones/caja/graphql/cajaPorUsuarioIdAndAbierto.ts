import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { cajaPorUsuarioIdAndAbiertoQuery, cajaQuery } from './graphql-query';

export interface Response {
  data: PdvCaja;
}

@Injectable({
  providedIn: 'root',
})
export class CajaPorUsuarioIdAndAbiertoGQL extends Query<Response> {
  document = cajaPorUsuarioIdAndAbiertoQuery;
}
