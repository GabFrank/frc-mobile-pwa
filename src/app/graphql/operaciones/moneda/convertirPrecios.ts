import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import { convertirPreciosDesdeQuery, convertirPreciosQuery, preciosEnOtraMonedaQuery } from './graphql-query';

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

/** Con los importes en otra moneda (`monedaOrigenId`). Solo un central nuevo la tiene. */
@Injectable({ providedIn: 'root' })
export class ConvertirPreciosDesdeGQL extends Query<Response> {
  document = convertirPreciosDesdeQuery;
}

/** Un precio que está en otra moneda que la de la empresa. */
export interface PrecioEnOtraMoneda {
  precioId: number | string;
  moneda: Pick<Moneda, 'id' | 'denominacion' | 'simbolo' | 'decimales'>;
}

/** Los precios en otra moneda. Solo un central nuevo la tiene. */
@Injectable({ providedIn: 'root' })
export class PreciosEnOtraMonedaGQL extends Query<{ data?: PrecioEnOtraMoneda[] }> {
  document = preciosEnOtraMonedaQuery;
}
