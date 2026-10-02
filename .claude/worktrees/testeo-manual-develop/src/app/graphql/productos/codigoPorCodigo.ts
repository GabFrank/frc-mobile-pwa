import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Codigo } from 'src/app/domains/productos/codigo.model';
import { codigoPorCodigoQuery } from './graphql-query';

export interface Response {
  data?: Codigo[];
}

@Injectable({ providedIn: 'root' })
export class CodigoPorCodigoGQL extends Query<Response> {
  document = codigoPorCodigoQuery;
}
