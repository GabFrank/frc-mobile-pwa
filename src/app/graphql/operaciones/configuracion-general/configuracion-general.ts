import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { configuracionGeneralQuery } from './graphql-query';

export interface ConfiguracionGeneral {
  id: number;
  nombreEmpresa?: string | null;
}

export interface Response {
  data?: ConfiguracionGeneral | null;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionGeneralGQL extends Query<Response> {
  document = configuracionGeneralQuery;
}
