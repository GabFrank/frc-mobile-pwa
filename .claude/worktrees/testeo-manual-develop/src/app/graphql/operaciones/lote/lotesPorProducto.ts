import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Lote } from 'src/app/domains/operaciones/lote.model';

import { lotesPorProductoQuery } from './graphql-query';

export interface Response {
  data?: Lote[];
}

@Injectable({ providedIn: 'root' })
export class LotesPorProductoGQL extends Query<Response> {
  document = lotesPorProductoQuery;
}
