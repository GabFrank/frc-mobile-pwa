import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { cancelarVentaQuery } from './graphql-query';

class Response {
  data?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CancelarVentaGQL extends Mutation<Response> {
  document = cancelarVentaQuery;
}
