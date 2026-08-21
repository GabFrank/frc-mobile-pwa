import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { proveedorPorIdQuery } from './graphql-query';

export interface Response {
  data?: Proveedor;
}

@Injectable({ providedIn: 'root' })
export class ProveedorPorIdGQL extends Query<Response> {
  document = proveedorPorIdQuery;
}
