import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { fotoFacturaQuery } from './graphql-query';

export interface Response {
  /** La foto como data URI. */
  data?: string;
}

@Injectable({ providedIn: 'root' })
export class FotoFacturaGQL extends Query<Response> {
  document = fotoFacturaQuery;
}
