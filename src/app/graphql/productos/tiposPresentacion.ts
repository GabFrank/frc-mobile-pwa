import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { TipoPresentacion } from 'src/app/domains/productos/tipo-presentacion.model';

import { tiposPresentacionQuery } from './graphql-query';

export interface Response {
  data?: TipoPresentacion[];
}

@Injectable({ providedIn: 'root' })
export class TiposPresentacionGQL extends Query<Response> {
  document = tiposPresentacionQuery;
}
