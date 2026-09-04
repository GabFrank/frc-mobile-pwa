import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Sector } from '../sector.model';
import { saveSector } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
/** Devuelve el sector guardado, no un booleano. */
export class SaveSectorGQL extends Mutation<{ data?: Sector }> {
  document = saveSector;
}
