import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { NotaRecepcionItem } from 'src/app/domains/pedidos/recepcion.model';
import { notaItemsPorNotaQuery } from './graphql-query';

export interface Response {
  data?: NotaRecepcionItem[];
}

@Injectable({ providedIn: 'root' })
export class NotaItemsPorNotaGQL extends Query<Response> {
  document = notaItemsPorNotaQuery;
}
