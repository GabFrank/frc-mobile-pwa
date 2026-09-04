import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { deleteZonaQuery, saveZona } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class DeleteZonaGQL extends Mutation<{ data?: boolean }> {
  document = deleteZonaQuery;
}
