import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { PrecioPorSucursal } from 'src/app/domains/productos/precio-por-sucursal.model';

import { savePrecioPorSucursalMutation } from './graphql-query';

export interface Response {
  data?: PrecioPorSucursal;
}

@Injectable({ providedIn: 'root' })
export class SavePrecioPorSucursalGQL extends Mutation<Response> {
  document = savePrecioPorSucursalMutation;
}
