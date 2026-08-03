import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { ventaQuery } from './graphql-query';
import { Venta } from 'src/app/domains/venta/venta.model';

class Response {
  data?: Venta;
}

@Injectable({
  providedIn: 'root',
})
export class VentaPorIdGQL extends Query<Response> {
  document = ventaQuery;
}
