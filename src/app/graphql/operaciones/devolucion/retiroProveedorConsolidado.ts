import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { RetiroProveedorConsolidado } from 'src/app/domains/devolucion/retiro.model';
import { retiroProveedorConsolidadoQuery } from './graphql-query';

export interface Response {
  data?: RetiroProveedorConsolidado;
}

@Injectable({ providedIn: 'root' })
export class RetiroProveedorConsolidadoGQL extends Query<Response> {
  document = retiroProveedorConsolidadoQuery;
}
