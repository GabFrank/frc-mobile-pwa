import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { inventariosPorUsuarioQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<Inventario>;
}

@Injectable({ providedIn: 'root' })
export class InventariosPorUsuarioGQL extends Query<Response> {
  document = inventariosPorUsuarioQuery;
}
