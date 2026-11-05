import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { ProveedorDeFactura } from 'src/app/domains/compras/compras.model';
import { registrarProveedorDeFacturaMutation } from './graphql-query';

export interface Response {
  data?: ProveedorDeFactura;
}

@Injectable({ providedIn: 'root' })
export class RegistrarProveedorDeFacturaGQL extends Mutation<Response> {
  document = registrarProveedorDeFacturaMutation;
}
