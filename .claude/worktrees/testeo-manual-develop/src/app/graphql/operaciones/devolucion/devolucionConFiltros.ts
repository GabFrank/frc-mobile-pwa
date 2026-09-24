import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Devolucion } from 'src/app/domains/devolucion/devolucion.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { devolucionConFiltrosQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<Devolucion>;
}

@Injectable({ providedIn: 'root' })
export class DevolucionConFiltrosGQL extends Query<Response> {
  document = devolucionConFiltrosQuery;
}
