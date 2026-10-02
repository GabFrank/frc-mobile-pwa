import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { configuracionVentaTarjetaQuery } from './graphql-query';

export interface Response {
  data?: { id?: number; habilitado?: boolean };
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionVentaTarjetaGQL extends Query<Response> {
  document = configuracionVentaTarjetaQuery;
}
