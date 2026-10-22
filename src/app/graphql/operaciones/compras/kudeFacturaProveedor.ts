import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { KudeProveedor } from 'src/app/domains/compras/compras.model';
import { kudeFacturaProveedorMutation } from './graphql-query';

export interface Response {
  data?: KudeProveedor;
}

@Injectable({ providedIn: 'root' })
export class KudeFacturaProveedorGQL extends Mutation<Response> {
  document = kudeFacturaProveedorMutation;
}
