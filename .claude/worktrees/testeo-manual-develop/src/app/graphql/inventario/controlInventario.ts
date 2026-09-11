import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { ProductoSaldo } from 'src/app/domains/inventario/producto-saldo.model';
import {
  productosConCantidadNegativaQuery,
  productosConCantidadPositivaQuery,
  productosFaltantesQuery,
} from './graphql-query';

type Respuesta = { data?: PageInfo<ProductoSaldo> };

@Injectable({ providedIn: 'root' })
export class ProductosCantidadPositivaGQL extends Query<Respuesta> {
  document = productosConCantidadPositivaQuery;
}

@Injectable({ providedIn: 'root' })
export class ProductosCantidadNegativaGQL extends Query<Respuesta> {
  document = productosConCantidadNegativaQuery;
}

@Injectable({ providedIn: 'root' })
export class ProductosFaltantesGQL extends Query<Respuesta> {
  document = productosFaltantesQuery;
}
