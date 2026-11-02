import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import type { CabeceraFacturaFoto } from 'src/app/domains/compras/compras.model';
import { leerFacturaFotoMutation } from './graphql-query';

export interface Response {
  data?: CabeceraFacturaFoto;
}

@Injectable({ providedIn: 'root' })
export class LeerFacturaFotoGQL extends Mutation<Response> {
  document = leerFacturaFotoMutation;
}
