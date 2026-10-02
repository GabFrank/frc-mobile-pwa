import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { transferenciasConFiltrosQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<Transferencia>;
}

@Injectable({ providedIn: 'root' })
export class TransferenciasConFiltrosGQL extends Query<Response> {
  document = transferenciasConFiltrosQuery;
}
