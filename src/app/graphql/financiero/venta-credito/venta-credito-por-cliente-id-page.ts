import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { VentaCredito } from 'src/app/domains/venta-credito/venta-credito.model';
import { ventaCreditoPorClientePageQuery } from './graphql-query';

export interface Response {
  data?: VentaCredito[];
}

@Injectable({
  providedIn: 'root',
})
export class VentaCreditoPorClientePageGQL extends Query<Response> {
  document = ventaCreditoPorClientePageQuery;
}
