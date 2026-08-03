import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { imprimirPagareQuery } from './graphql-query';

class Response {
  data?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ImprimirPagareGQL extends Mutation<Response> {
  document = imprimirPagareQuery;
}
