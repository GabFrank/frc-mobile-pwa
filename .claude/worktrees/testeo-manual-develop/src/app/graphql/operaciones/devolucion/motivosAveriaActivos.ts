import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { MotivoAveria } from 'src/app/domains/devolucion/devolucion.model';
import { motivosAveriaActivosQuery } from './graphql-query';

export interface Response {
  data?: MotivoAveria[];
}

@Injectable({ providedIn: 'root' })
export class MotivosAveriaActivosGQL extends Query<Response> {
  document = motivosAveriaActivosQuery;
}
