import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Producto } from 'src/app/domains/productos/producto.model';

import { saveProductoMutation } from './graphql-query';

export interface Response {
  data?: Producto;
}

@Injectable({ providedIn: 'root' })
export class SaveProductoGQL extends Mutation<Response> {
  document = saveProductoMutation;
}
