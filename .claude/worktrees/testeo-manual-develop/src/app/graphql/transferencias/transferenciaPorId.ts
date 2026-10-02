import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import { transferenciaPorIdQuery } from './graphql-query';

export interface Response {
  data?: Transferencia;
}

@Injectable({ providedIn: 'root' })
export class TransferenciaPorIdGQL extends Query<Response> {
  document = transferenciaPorIdQuery;
}
