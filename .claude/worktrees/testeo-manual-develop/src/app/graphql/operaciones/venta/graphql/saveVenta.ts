import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveVenta } from './graphql-query';
import { Venta } from 'src/app/domains/venta/venta.model';

class Response {
  data?: Venta;
}

@Injectable({
  providedIn: 'root',
})
export class SaveVentaGQL extends Mutation<Response> {
  document = saveVenta;
}
