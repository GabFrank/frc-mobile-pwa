import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { solicitudPagoPdfMutation } from './graphql-query';

/** El PDF llega como base64 crudo, sin nombre de archivo. */
export interface Response {
  data?: string;
}

@Injectable({ providedIn: 'root' })
export class SolicitudPagoPdfGQL extends Mutation<Response> {
  document = solicitudPagoPdfMutation;
}
