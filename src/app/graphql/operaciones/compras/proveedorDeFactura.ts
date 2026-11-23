import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { ProveedorDeFactura } from 'src/app/domains/compras/compras.model';
import { proveedorDeFacturaMutation } from './graphql-query';

export interface Response {
  data?: ProveedorDeFactura;
}

@Injectable({ providedIn: 'root' })
export class ProveedorDeFacturaGQL extends Mutation<Response> {
  document = proveedorDeFacturaMutation;
}
