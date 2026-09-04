import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { ConstanciaRecepcionPdf } from 'src/app/domains/pedidos/recepcion.model';
import { constanciaRecepcionPdfQuery } from './graphql-query';

export interface Response {
  data?: ConstanciaRecepcionPdf;
}

@Injectable({ providedIn: 'root' })
export class ConstanciaRecepcionPdfGQL extends Query<Response> {
  document = constanciaRecepcionPdfQuery;
}
