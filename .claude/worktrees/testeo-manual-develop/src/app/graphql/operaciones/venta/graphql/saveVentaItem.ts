import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveVentaItemQuery } from './graphql-query';
import { VentaItem } from 'src/app/domains/venta/venta.model';

class Response {
  data?: VentaItem;
}

@Injectable({
  providedIn: 'root',
})
export class SaveVentaItemGQL extends Mutation<Response> {
  document = saveVentaItemQuery;
}
