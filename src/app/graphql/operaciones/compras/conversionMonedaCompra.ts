import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { ConversionMoneda } from 'src/app/domains/compras/compras.model';
import { conversionMonedaCompraQuery } from './graphql-query';

export interface Response {
  data?: ConversionMoneda;
}

@Injectable({ providedIn: 'root' })
export class ConversionMonedaCompraGQL extends Query<Response> {
  document = conversionMonedaCompraQuery;
}
