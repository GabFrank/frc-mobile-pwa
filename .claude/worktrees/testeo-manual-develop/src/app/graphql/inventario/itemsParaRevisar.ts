import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { InventarioProductoItem } from 'src/app/domains/inventario/inventario.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { itemsParaRevisarQuery } from './graphql-query';

type Respuesta = { data?: PageInfo<InventarioProductoItem> };

@Injectable({ providedIn: 'root' })
export class ItemsParaRevisarGQL extends Query<Respuesta> {
  document = itemsParaRevisarQuery;
}
