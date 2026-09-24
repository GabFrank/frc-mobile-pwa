import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import { notaDisponibleParaPagoQuery } from './graphql-query';

export interface Response {
  data?: NotaRecepcion | null;
}

@Injectable({ providedIn: 'root' })
export class NotaDisponibleParaPagoGQL extends Query<Response> {
  document = notaDisponibleParaPagoQuery;
}
