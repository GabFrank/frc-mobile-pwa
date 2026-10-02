import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { Persona } from 'src/app/domains/personas/persona.model';
import { personaSearchPageQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<Persona>;
}

@Injectable({ providedIn: 'root' })
export class PersonaSearchPageGQL extends Query<Response> {
  document = personaSearchPageQuery;
}
