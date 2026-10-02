import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { recepcionesConFiltrosQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<RecepcionMercaderia>;
}

@Injectable({ providedIn: 'root' })
export class RecepcionesConFiltrosGQL extends Query<Response> {
  document = recepcionesConFiltrosQuery;
}
