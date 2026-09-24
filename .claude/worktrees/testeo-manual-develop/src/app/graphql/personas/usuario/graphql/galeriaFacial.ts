import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { galeriaFacialQuery } from './graphql-query';

export interface UsuarioConGaleria {
  id?: number;
  persona?: { id?: number; embeddingFacial?: string };
}

@Injectable({ providedIn: 'root' })
export class GaleriaFacialGQL extends Query<{ data?: UsuarioConGaleria }> {
  document = galeriaFacialQuery;
}
