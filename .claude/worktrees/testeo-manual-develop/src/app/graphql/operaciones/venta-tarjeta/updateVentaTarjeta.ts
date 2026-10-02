import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { VentaTarjeta } from 'src/app/domains/venta-tarjeta/venta-tarjeta.model';
import { updateVentaTarjetaMutation } from './graphql-query';

export interface Response {
  data?: VentaTarjeta;
}

@Injectable({ providedIn: 'root' })
export class UpdateVentaTarjetaGQL extends Mutation<Response> {
  document = updateVentaTarjetaMutation;
}
