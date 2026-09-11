import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { SolicitudPago } from 'src/app/domains/pedidos/solicitud-pago.model';
import { solicitudPagoPorIdQuery } from './graphql-query';

export interface Response {
  data?: SolicitudPago;
}

@Injectable({ providedIn: 'root' })
export class SolicitudPagoPorIdGQL extends Query<Response> {
  document = solicitudPagoPorIdQuery;
}
