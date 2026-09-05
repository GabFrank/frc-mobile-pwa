import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { VentaCredito } from 'src/app/domains/venta-credito/venta-credito.model';
import { ventaCreditoPorClienteQuery } from './graphql-query';

export interface Response {
  data?: VentaCredito[];
}

@Injectable({
  providedIn: 'root',
})
export class VentaCreditoPorClienteGQL extends Query<Response> {
  document = ventaCreditoPorClienteQuery;
}
