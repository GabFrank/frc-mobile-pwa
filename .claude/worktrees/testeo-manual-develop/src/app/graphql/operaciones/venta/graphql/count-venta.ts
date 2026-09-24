import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { countVentaQuery } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class CountVentaGQL extends Query<{ data?: number }> {
  document = countVentaQuery;
}
