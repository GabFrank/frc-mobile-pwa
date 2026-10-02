import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import { formasPagoQuery } from './graphql-query';

export interface Response {
  data?: FormaPago[];
}

@Injectable({ providedIn: 'root' })
export class FormasPagoGQL extends Query<Response> {
  document = formasPagoQuery;
}
