import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { countVentasTarjetaSinRegistrarQuery } from './graphql-query';

export interface Response {
  data?: number;
}

@Injectable({ providedIn: 'root' })
export class CountVentasTarjetaSinRegistrarGQL extends Query<Response> {
  document = countVentasTarjetaSinRegistrarQuery;
}
