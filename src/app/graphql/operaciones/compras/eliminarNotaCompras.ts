import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { CompraPedido } from 'src/app/domains/compras/compras.model';
import { eliminarNotaComprasMutation } from './graphql-query';

export interface Response {
  data?: CompraPedido;
}

@Injectable({ providedIn: 'root' })
export class EliminarNotaComprasGQL extends Mutation<Response> {
  document = eliminarNotaComprasMutation;
}
