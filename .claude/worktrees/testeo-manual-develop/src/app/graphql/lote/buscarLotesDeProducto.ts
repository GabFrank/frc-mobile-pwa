import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { LoteDeProducto } from 'src/app/domains/lote/lote.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { buscarLotesDeProductoQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<LoteDeProducto>;
}

@Injectable({ providedIn: 'root' })
export class BuscarLotesDeProductoGQL extends Query<Response> {
  document = buscarLotesDeProductoQuery;
}
