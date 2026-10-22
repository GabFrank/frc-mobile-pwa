import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { OpcionesNuevaCompra } from 'src/app/domains/compras/compras.model';
import { opcionesNuevaCompraQuery } from './graphql-query';

export interface Response {
  data?: OpcionesNuevaCompra;
}

@Injectable({ providedIn: 'root' })
export class OpcionesNuevaCompraGQL extends Query<Response> {
  document = opcionesNuevaCompraQuery;
}
