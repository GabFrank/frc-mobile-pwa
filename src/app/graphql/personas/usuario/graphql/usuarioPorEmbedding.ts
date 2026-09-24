import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { usuarioPorEmbeddingQuery } from './graphql-query';

export interface UsuarioSimilitud {
  usuario?: Usuario;
  similitud?: number;
  /** La del siguiente candidato. `null` si hay un solo enrolado. */
  similitudSegundo?: number | null;
  /**
   * `similitud - similitudSegundo`.
   *
   * ⚠️ **Es el dato que dice si el 1:N fue sólido o una moneda al aire.** Un
   * `0.71` contra un segundo de `0.45` identifica; el mismo `0.71` contra un
   * `0.69` no. Llega desde `v?` del central — contra uno anterior viene
   * `undefined`, y eso no rompe nada: se guarda vacío.
   */
  margen?: number | null;
}

export interface Response {
  data?: UsuarioSimilitud;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioPorEmbeddingGQL extends Query<Response> {
  document = usuarioPorEmbeddingQuery;
}
