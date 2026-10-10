import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import { transferenciasPorUsuarioQuery } from './graphql-query';

export interface Response {
  data?: Transferencia[];
}

@Injectable({ providedIn: 'root' })
export class TransferenciasPorUsuarioGQL extends Query<Response> {
  document = transferenciasPorUsuarioQuery;
}
