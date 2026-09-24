import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Zona } from '../zona.model';
import { saveZona } from './graphql-query';

@Injectable({
  providedIn: 'root',
})
/** Devuelve la zona guardada, no un booleano. */
export class SaveZonaGQL extends Mutation<{ data?: Zona }> {
  document = saveZona;
}
