import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { actualizarTokenFcmGQL } from './graphql-query';

/**
 * ⚠️ **El genérico es `{ data?: boolean }`, no un objeto envuelto.** La
 * mutación aliasea su campo raíz a `data` y devuelve un `Boolean!`; declararlo
 * como `{ data?: { data?: boolean } }` —como venía del port— hacía que
 * `DatosService` entregara un booleano tipado como objeto, y ningún chequeo lo
 * atrapaba porque nadie lo usaba todavía.
 */
@Injectable({
  providedIn: 'root'
})
export class ActualizarTokenFcmGQL extends Mutation<{ data?: boolean }> {
  document = actualizarTokenFcmGQL;
}
