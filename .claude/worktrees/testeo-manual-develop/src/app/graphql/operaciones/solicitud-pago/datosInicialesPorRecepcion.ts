import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { DatosInicialesSolicitudPago } from 'src/app/domains/pedidos/solicitud-pago.model';
import { datosInicialesPorRecepcionQuery } from './graphql-query';

export interface Response {
  data?: DatosInicialesSolicitudPago;
}

@Injectable({ providedIn: 'root' })
export class DatosInicialesPorRecepcionGQL extends Query<Response> {
  document = datosInicialesPorRecepcionQuery;
}
