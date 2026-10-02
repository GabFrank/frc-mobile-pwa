import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';

import { saveTransferenciaMutation } from './graphql-query';

export interface Response {
  data?: Transferencia;
}

@Injectable({ providedIn: 'root' })
export class SaveTransferenciaGQL extends Mutation<Response> {
  document = saveTransferenciaMutation;
}
