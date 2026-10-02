import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { usuarioQuery, usuariosSearch } from './graphql-query';

class Response {
  data?: Usuario[];
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioSearchGQL extends Query<{ data?: Usuario[] }> {
  document = usuariosSearch;
}
