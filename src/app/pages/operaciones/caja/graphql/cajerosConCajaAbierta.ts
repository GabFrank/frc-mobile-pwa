import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { cajerosConCajaAbiertaQuery } from './graphql-query';

export interface Response {
  data?: Usuario[];
}

@Injectable({
  providedIn: 'root',
})
export class CajerosConCajaAbiertaGQL extends Query<Response> {
  document = cajerosConCajaAbiertaQuery;
}
