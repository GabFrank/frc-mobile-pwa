import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveUsuarioImageQuery } from './graphql-query';

@Injectable({
  providedIn: 'root'
})
export class SaveUsuarioImageGQL extends Mutation<{ data?: boolean }> {
  document = saveUsuarioImageQuery;
}
