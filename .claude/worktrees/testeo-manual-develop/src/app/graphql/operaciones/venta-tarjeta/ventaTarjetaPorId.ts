import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { VentaTarjeta } from 'src/app/domains/venta-tarjeta/venta-tarjeta.model';
import { ventaTarjetaPorIdQuery } from './graphql-query';

export interface Response {
  data?: VentaTarjeta;
}

@Injectable({ providedIn: 'root' })
export class VentaTarjetaPorIdGQL extends Query<Response> {
  document = ventaTarjetaPorIdQuery;
}
