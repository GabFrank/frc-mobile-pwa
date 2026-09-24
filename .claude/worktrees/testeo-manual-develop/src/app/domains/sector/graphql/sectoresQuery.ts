import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Sector } from '../sector.model';
import { sectoresQuery } from './graphql-query';

export interface Response {
  data?: Sector[];
}

@Injectable({
  providedIn: 'root',
})
export class SectoresGQL extends Query<{ data?: Sector[] }> {
  document = sectoresQuery;
}
