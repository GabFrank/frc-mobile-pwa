import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Equipo, Inmueble, Mueble, Vehiculo } from 'src/app/domains/gastos/ente.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  equipoSearchPageQuery,
  inmuebleSearchPageQuery,
  muebleSearchPageQuery,
  vehiculoSearchPageQuery,
} from './graphql-query';

@Injectable({ providedIn: 'root' })
export class VehiculoSearchPageGQL extends Query<{ data?: PageInfo<Vehiculo> }> {
  document = vehiculoSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class MuebleSearchPageGQL extends Query<{ data?: PageInfo<Mueble> }> {
  document = muebleSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class InmuebleSearchPageGQL extends Query<{ data?: PageInfo<Inmueble> }> {
  document = inmuebleSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class EquipoSearchPageGQL extends Query<{ data?: PageInfo<Equipo> }> {
  document = equipoSearchPageQuery;
}
