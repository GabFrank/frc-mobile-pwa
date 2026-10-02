import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Cliente } from 'src/app/domains/cliente/cliente.model';
import { clientePorPersonaDocumento } from './graphql-query';

export interface Response {
  data?: Cliente;
}


@Injectable({
  providedIn: 'root',
})
export class ClientePersonaDocumentoGQL extends Query<Response> {
  document = clientePorPersonaDocumento;
}
