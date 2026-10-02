import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Devolucion } from 'src/app/domains/devolucion/devolucion.model';
import { devolucionByIdQuery } from './graphql-query';

export interface Response {
  data?: Devolucion;
}

@Injectable({ providedIn: 'root' })
export class DevolucionByIdGQL extends Query<Response> {
  document = devolucionByIdQuery;
}
