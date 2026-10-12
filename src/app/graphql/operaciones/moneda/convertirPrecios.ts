import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import { convertirPreciosQuery } from './graphql-query';

/** Una fila por moneda: los importes pedidos, ya convertidos por el central. */
export interface PreciosEnMoneda {
  moneda: Pick<Moneda, 'id' | 'denominacion' | 'simbolo'>;
  decimales: number;
  montos: (number | null)[];
}

export interface Response {
  data?: PreciosEnMoneda[];
}

@Injectable({ providedIn: 'root' })
export class ConvertirPreciosGQL extends Query<Response> {
  document = convertirPreciosQuery;
}
