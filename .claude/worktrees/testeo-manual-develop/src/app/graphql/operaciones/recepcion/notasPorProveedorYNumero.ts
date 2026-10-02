import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import { notasPorProveedorYNumeroQuery } from './graphql-query';

export interface Response {
  data?: NotaRecepcion[];
}

@Injectable({ providedIn: 'root' })
export class NotasPorProveedorYNumeroGQL extends Query<Response> {
  document = notasPorProveedorYNumeroQuery;
}
