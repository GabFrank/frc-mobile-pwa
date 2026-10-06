import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { presentacionesImagenesQuery } from './graphql-query';

export interface Response {
  data?: Pick<Presentacion, 'id' | 'imagenPrincipal' | 'imagenPrincipalMediana'>[];
}

@Injectable({ providedIn: 'root' })
export class PresentacionesImagenesGQL extends Query<Response> {
  document = presentacionesImagenesQuery;
}
