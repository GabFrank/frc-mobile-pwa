import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { ResumenFinalizarNotas } from 'src/app/domains/compras/compras.model';
import { resumenFinalizarNotasQuery } from './graphql-query';

export interface Response {
  data?: ResumenFinalizarNotas;
}

@Injectable({ providedIn: 'root' })
export class ResumenFinalizarNotasGQL extends Query<Response> {
  document = resumenFinalizarNotasQuery;
}
