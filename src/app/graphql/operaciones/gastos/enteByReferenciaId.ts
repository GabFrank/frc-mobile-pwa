import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Ente } from 'src/app/domains/gastos/ente.model';
import { enteByReferenciaIdQuery } from './graphql-query';

export interface Response {
  data?: Ente;
}

@Injectable({ providedIn: 'root' })
export class EnteByReferenciaIdGQL extends Query<Response> {
  document = enteByReferenciaIdQuery;
}
