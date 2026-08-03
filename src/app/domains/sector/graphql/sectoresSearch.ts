import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Sector } from '../sector.model';
import { sectoresSearch } from './graphql-query';

export interface Response {
  data?: Sector[];
}


@Injectable({
  providedIn: 'root',
})
export class SectoresSearchGQL extends Query<Response> {
  document = sectoresSearch;
}
