import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Marcacion } from 'src/app/domains/marcacion/marcacion.model';
import { saveMarcacionMutation } from './graphql-query';

export interface Response {
  data?: Marcacion;
}

@Injectable({ providedIn: 'root' })
export class SaveMarcacionGQL extends Mutation<Response> {
  document = saveMarcacionMutation;
}
