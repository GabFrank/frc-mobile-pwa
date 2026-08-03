import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { CajaBalance, PdvCaja } from 'src/app/domains/caja/caja.model';
import { balancePorFecha, cajaQuery, cajasPorFecha, cajasQuery } from './graphql-query';

export interface Response {
  data: CajaBalance;
}

@Injectable({
  providedIn: 'root',
})
export class BalancePorFechaGQL extends Query<Response> {
  document = balancePorFecha;
}
