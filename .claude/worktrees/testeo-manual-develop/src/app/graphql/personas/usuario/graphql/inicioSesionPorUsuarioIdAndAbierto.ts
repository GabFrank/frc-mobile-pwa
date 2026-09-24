import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { PageInfo } from 'src/app/domains/page-info.model';
import { inicioSesionListPorUsuarioIdAndAbiertoGQL } from './graphql-query';
import { InicioSesion } from 'src/app/domains/configuracion/inicio-sesion.model';

@Injectable({
  providedIn: 'root',
})
export class InicioSesionListPorUsuarioIdAndAbiertoGQL extends Query<{ data?: PageInfo<InicioSesion> }> {
  document = inicioSesionListPorUsuarioIdAndAbiertoGQL;
}
