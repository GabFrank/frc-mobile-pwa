import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { saveZona } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
export class SaveZonaGQL extends Mutation<{ data?: boolean }> {
  document = saveZona;
}
