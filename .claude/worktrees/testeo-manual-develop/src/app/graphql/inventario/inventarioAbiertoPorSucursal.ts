import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import { inventarioAbiertoPorSucursalQuery } from './graphql-query';

export interface Response {
  data?: Inventario[];
}

@Injectable({ providedIn: 'root' })
export class InventarioAbiertoPorSucursalGQL extends Query<Response> {
  document = inventarioAbiertoPorSucursalQuery;
}
