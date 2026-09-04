import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { proveedoresPorTextoQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<Proveedor>;
}

@Injectable({ providedIn: 'root' })
export class ProveedoresPorTextoGQL extends Query<Response> {
  document = proveedoresPorTextoQuery;
}
