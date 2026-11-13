import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { convenioOtraEmpresaQuery } from './graphql-query';

/** Lo que devuelve el central: `null` si no hay convenio allá o no está configurado. */
export interface ConvenioRemoto {
  empresa?: string;
  limite?: number;
  utilizado?: number;
}

export interface Response {
  data?: ConvenioRemoto | null;
}

@Injectable({
  providedIn: 'root',
})
export class ConvenioOtraEmpresaGQL extends Query<Response> {
  document = convenioOtraEmpresaQuery;
}
