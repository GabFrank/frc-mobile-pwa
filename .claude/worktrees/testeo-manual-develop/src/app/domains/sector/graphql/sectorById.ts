import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Sector } from '../sector.model';
import { sectorQuery } from './graphql-query';

export interface Response {
  data?: Sector;
}

@Injectable({
  providedIn: 'root',
})
export class SectorByIdGQL extends Query<Response> {
  document = sectorQuery;
}
