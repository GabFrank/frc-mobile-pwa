import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { usuarioParaCambioClaveQuery } from './graphql-query';

export interface UsuarioParaCambioClave {
  id: number;
  nickname: string;
  activo?: boolean | null;
  persona?: { id: number } | null;
  usuario?: { id: number } | null;
}

export interface Response {
  data?: UsuarioParaCambioClave;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioParaCambioClaveGQL extends Query<Response> {
  document = usuarioParaCambioClaveQuery;
}
