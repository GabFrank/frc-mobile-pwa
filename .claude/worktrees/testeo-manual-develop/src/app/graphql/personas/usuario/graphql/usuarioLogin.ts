import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { usuarioLoginQuery } from './graphql-query';

export interface Response {
  data?: Usuario;
}

// Query de usuario para el login. Duplica UsuarioPorIdGQL pero sin
// `persona.embeddingFacial`, para mantener compatibilidad con servidores en
// `release/beta` que aun no tienen ese campo en el schema.
@Injectable({
  providedIn: 'root',
})
export class UsuarioLoginGQL extends Query<Response> {
  document = usuarioLoginQuery;
}
