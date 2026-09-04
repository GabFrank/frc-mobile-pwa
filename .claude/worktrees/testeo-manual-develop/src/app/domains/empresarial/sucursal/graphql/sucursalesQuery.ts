import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Sucursal } from '../sucursal.model';
import { sucursalesQuery, sucursalQuery } from './graphql-query';

export interface Response {
  data?: Sucursal[];
}

@Injectable({
  providedIn: 'root',
})
export class SucursalesGQL extends Query<{ data?: Sucursal[] }> {
  document = sucursalesQuery;
}
