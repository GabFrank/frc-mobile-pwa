import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { deleteVentaQuery } from './graphql-query';
import { Venta } from 'src/app/domains/venta/venta.model';

class Response {
  data?: Venta;
}

@Injectable({
  providedIn: 'root',
})
export class DeleteVentaGQL extends Mutation<{ data?: boolean }> {
  document = deleteVentaQuery;
}
