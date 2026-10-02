import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { reimprimirVentaQuery } from './graphql-query';

class Response {
  data?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ReimprimirVentaGQL extends Mutation<Response> {
  document = reimprimirVentaQuery;
}
