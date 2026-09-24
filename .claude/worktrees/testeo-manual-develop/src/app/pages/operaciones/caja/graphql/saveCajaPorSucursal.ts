import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { savePdvCajaPorSucursal } from './graphql-query';

export interface Response {
  data: PdvCaja;
}

@Injectable({
  providedIn: 'root',
})
export class SaveCajaPorSucursalGQL extends Mutation<Response> {
  document = savePdvCajaPorSucursal;
}
