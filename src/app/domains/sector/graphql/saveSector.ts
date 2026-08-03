import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveSector } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class SaveSectorGQL extends Mutation<{ data?: boolean }> {
  document = saveSector;
}
