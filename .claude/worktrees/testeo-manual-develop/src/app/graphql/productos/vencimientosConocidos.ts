import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { ProductoVencido } from 'src/app/domains/productos/producto-vencido.model';
import { vencimientosConocidosQuery } from './graphql-query';

export interface Response {
  /** Lista, no página: el central ya la recortó por presentación. */
  data?: ProductoVencido[];
}

@Injectable({ providedIn: 'root' })
export class VencimientosConocidosGQL extends Query<Response> {
  document = vencimientosConocidosQuery;
}
