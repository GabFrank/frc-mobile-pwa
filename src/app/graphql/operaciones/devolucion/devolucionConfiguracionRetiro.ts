import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { DevolucionConfiguracionRetiro } from 'src/app/domains/devolucion/retiro.model';
import { devolucionConfiguracionRetiroQuery } from './graphql-query';

export interface Response {
  data?: DevolucionConfiguracionRetiro;
}

@Injectable({ providedIn: 'root' })
export class DevolucionConfiguracionRetiroGQL extends Query<Response> {
  document = devolucionConfiguracionRetiroQuery;
}
