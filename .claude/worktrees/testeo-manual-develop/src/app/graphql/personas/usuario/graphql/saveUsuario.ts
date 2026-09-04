import { Injectable } from '@angular/core';
import { Mutation, Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { saveUsuario, usuarioQuery } from './graphql-query';

export interface Response {
  data?: Usuario;
}

@Injectable({
  providedIn: 'root',
})
export class SaveUsuarioGQL extends Mutation<Response> {
  document = saveUsuario;
}
