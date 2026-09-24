import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { InventarioProductoItem } from 'src/app/domains/inventario/inventario.model';
import { saveInventarioProductoItemMutation } from './graphql-query';

export interface Response {
  data?: InventarioProductoItem;
}

@Injectable({ providedIn: 'root' })
export class SaveInventarioProductoItemGQL extends Mutation<Response> {
  document = saveInventarioProductoItemMutation;
}
