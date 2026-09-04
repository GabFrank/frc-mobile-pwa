import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { InventarioProducto } from 'src/app/domains/inventario/inventario.model';
import { saveInventarioProductoMutation } from './graphql-query';

export interface Response {
  data?: InventarioProducto;
}

@Injectable({ providedIn: 'root' })
export class SaveInventarioProductoGQL extends Mutation<Response> {
  document = saveInventarioProductoMutation;
}
