import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { generarCodigoInternoQuery } from './graphql-query';

export interface Response {
  data?: string;
}

@Injectable({ providedIn: 'root' })
export class GenerarCodigoInternoGQL extends Query<Response> {
  document = generarCodigoInternoQuery;
}
