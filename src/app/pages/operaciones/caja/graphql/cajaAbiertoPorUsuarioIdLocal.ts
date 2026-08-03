import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { cajaAbiertoPorUsuarioIdLocalQuery } from './graphql-query';

export interface Response {
  data: PdvCaja[];
}

@Injectable({
  providedIn: 'root',
})
export class CajaAbiertoPorUsuarioIdLocalGQL extends Query<Response> {
  document = cajaAbiertoPorUsuarioIdLocalQuery;
}
