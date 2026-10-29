import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { FacturaProveedor } from 'src/app/domains/compras/compras.model';
import { leerFacturaNuevaCompraMutation } from './graphql-query';

export interface Response {
  data?: FacturaProveedor;
}

@Injectable({ providedIn: 'root' })
export class LeerFacturaNuevaCompraGQL extends Mutation<Response> {
  document = leerFacturaNuevaCompraMutation;
}
