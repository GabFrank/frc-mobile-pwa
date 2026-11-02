import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { remitoRetiroProveedorQuery } from './graphql-query';

export interface Response {
  data?: string;
}

@Injectable({ providedIn: 'root' })
export class RemitoRetiroProveedorGQL extends Query<Response> {
  document = remitoRetiroProveedorQuery;
}
