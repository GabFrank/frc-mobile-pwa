import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { ConfiguracionNotificacion } from 'src/app/domains/notificacion/notificacion.model';
import { misConfiguracionesQuery } from './graphql-query';

export interface Response {
  data?: ConfiguracionNotificacion[];
}

@Injectable({ providedIn: 'root' })
export class MisConfiguracionesGQL extends Query<Response> {
  document = misConfiguracionesQuery;
}
