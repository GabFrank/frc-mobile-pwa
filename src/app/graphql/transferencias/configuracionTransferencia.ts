import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';

import { configuracionTransferenciaQuery } from './graphql-query';

export interface ConfiguracionTransferencia {
  id?: number;
  permitirStockNegativo?: boolean;
}

export interface Response {
  data?: ConfiguracionTransferencia;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionTransferenciaGQL extends Query<Response> {
  document = configuracionTransferenciaQuery;
}
