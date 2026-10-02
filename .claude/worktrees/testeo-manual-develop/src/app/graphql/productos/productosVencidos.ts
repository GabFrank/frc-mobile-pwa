import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { ProductoVencido } from 'src/app/domains/productos/producto-vencido.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { productosVencidosQuery } from './graphql-query';

export interface Response {
  data?: PageInfo<ProductoVencido>;
}

@Injectable({ providedIn: 'root' })
export class ProductosVencidosGQL extends Query<Response> {
  document = productosVencidosQuery;
}
