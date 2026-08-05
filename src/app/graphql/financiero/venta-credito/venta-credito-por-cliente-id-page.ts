import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { VentaCredito } from 'src/app/domains/venta-credito/venta-credito.model';
import { ventaCreditoPorClientePageQuery } from './graphql-query';

/**
 * ⚠️ Devuelve una **página**, no una lista.
 *
 * El archivo venía del repo anterior tipado `VentaCredito[]`, copiado de la
 * variante sin paginar. La query pide `getContent`, `getTotalPages` y demás,
 * así que el tipo declaraba un array donde llega un objeto: cualquier
 * `.map()` sobre el resultado habría explotado en runtime sin que el
 * compilador dijera nada.
 */
export interface Response {
  data?: PageInfo<VentaCredito>;
}

@Injectable({
  providedIn: 'root',
})
export class VentaCreditoPorClientePageGQL extends Query<Response> {
  document = ventaCreditoPorClientePageQuery;
}
