import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { SolicitudPago } from 'src/app/domains/pedidos/solicitud-pago.model';
import { solicitudesPagoPaginadasQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<SolicitudPago>;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesPagoPaginadasGQL extends Query<Response> {
  document = solicitudesPagoPaginadasQuery;
}
