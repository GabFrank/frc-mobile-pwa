import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { usuarioPorEmbeddingQuery } from './graphql-query';

export interface UsuarioSimilitud {
  usuario?: Usuario;
  similitud?: number;
}

export interface Response {
  data?: UsuarioSimilitud;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioPorEmbeddingGQL extends Query<Response> {
  document = usuarioPorEmbeddingQuery;
}
