import { Injectable } from '@angular/core';
import { Mutation, Query } from 'src/app/core/graphql/gql-base';
import { deleteCajaQuery } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class DeleteCajaGQL extends Mutation<{ data?: boolean }> {
  document = deleteCajaQuery;
}
