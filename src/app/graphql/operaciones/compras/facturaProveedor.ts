import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { FacturaProveedor } from 'src/app/domains/compras/compras.model';
import { facturaProveedorQuery } from './graphql-query';

export interface Response {
  data?: FacturaProveedor;
}

@Injectable({ providedIn: 'root' })
export class FacturaProveedorGQL extends Query<Response> {
  document = facturaProveedorQuery;
}
