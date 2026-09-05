import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { EstadoMarcacionUsuario } from 'src/app/domains/marcacion/marcacion.model';
import { estadoMarcacionUsuarioQuery } from './graphql-query';

export interface Response {
  data?: EstadoMarcacionUsuario;
}

@Injectable({ providedIn: 'root' })
export class EstadoMarcacionUsuarioGQL extends Query<Response> {
  document = estadoMarcacionUsuarioQuery;
}
