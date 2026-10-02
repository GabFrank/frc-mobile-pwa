import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { TransferenciaItem } from 'src/app/domains/transferencia/transferencia.model';
import { itemsPorTransferenciaQuery } from './graphql-query';

/** La query devuelve un `TransferenciaItemPage`: los ítems van en `getContent`. */
export interface Response {
  data?: { getContent?: TransferenciaItem[] };
}

@Injectable({ providedIn: 'root' })
export class ItemsPorTransferenciaGQL extends Query<Response> {
  document = itemsPorTransferenciaQuery;
}
