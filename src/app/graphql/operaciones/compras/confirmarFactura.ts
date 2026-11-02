import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { CompraNota } from 'src/app/domains/compras/compras.model';
import { confirmarFacturaMutation } from './graphql-query';

export interface Response {
  data?: CompraNota;
}

@Injectable({ providedIn: 'root' })
export class ConfirmarFacturaGQL extends Mutation<Response> {
  document = confirmarFacturaMutation;
}
