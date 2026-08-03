import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { deleteSectorQuery, saveSector } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class DeleteSectorGQL extends Mutation<{ data?: boolean }> {
  document = deleteSectorQuery;
}
