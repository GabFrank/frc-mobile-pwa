import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { Transferencia } from 'src/app/domains/transferencia/transferencia.model';

import { verificarParaTransporteMutation } from './graphql-query';

export interface Response {
  data?: Transferencia;
}

@Injectable({ providedIn: 'root' })
export class VerificarParaTransporteGQL extends Mutation<Response> {
  document = verificarParaTransporteMutation;
}
