import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { SolicitudPago } from 'src/app/domains/pedidos/solicitud-pago.model';
import { actualizarEstadoSolicitudPagoMutation } from './graphql-query';

export interface Response {
  data?: SolicitudPago;
}

@Injectable({ providedIn: 'root' })
export class ActualizarEstadoSolicitudPagoGQL extends Mutation<Response> {
  document = actualizarEstadoSolicitudPagoMutation;
}
