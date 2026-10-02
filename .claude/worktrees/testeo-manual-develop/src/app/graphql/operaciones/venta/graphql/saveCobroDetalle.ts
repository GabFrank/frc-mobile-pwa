import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveCobroDetalleQuery } from './graphql-query';

class Response {
  data?: any;
}

@Injectable({
  providedIn: 'root',
})
export class SaveCobroDetalleGQL extends Mutation<Response> {
  document = saveCobroDetalleQuery;
}
