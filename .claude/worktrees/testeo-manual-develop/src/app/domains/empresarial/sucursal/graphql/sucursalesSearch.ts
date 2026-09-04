import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Sucursal } from '../sucursal.model';
import { sucursalesSearch } from './graphql-query';

/** La query devuelve un `SucursalPage`: las sucursales van en `getContent`. */
export interface Response {
  data?: { getContent?: Sucursal[] };
}


@Injectable({
  providedIn: 'root',
})
export class SucursalesSearchGQL extends Query<Response> {
  document = sucursalesSearch;
}
