import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { incorporarEmbeddingMarcacionQuery } from './graphql-query';

@Injectable({
  providedIn: 'root'
})
export class IncorporarEmbeddingMarcacionGQL extends Mutation<{ data: boolean }> {
  document = incorporarEmbeddingMarcacionQuery;
}
