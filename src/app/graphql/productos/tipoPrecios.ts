import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { TipoPrecio } from 'src/app/domains/productos/tipo-precio.model';

import { tipoPreciosQuery } from './graphql-query';

export interface Response {
  data?: TipoPrecio[];
}

@Injectable({ providedIn: 'root' })
export class TipoPreciosGQL extends Query<Response> {
  document = tipoPreciosQuery;
}
