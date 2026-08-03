import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import type { ErrorPolicy, FetchPolicy, MutationFetchPolicy } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Shim de compatibilidad para las clases base de `apollo-angular`.
 *
 * `apollo-angular` v14 eliminó `Query`, `Mutation` y `Subscription`: solo
 * quedan `Apollo`, `ApolloBase` y `QueryRef`. Los ~296 documentos GraphQL
 * portados del repo `frc-mobile` los extienden, así que sin esto habría que
 * reescribirlos uno por uno.
 *
 * Estas clases reimplementan la misma API sobre `Apollo`, de modo que el
 * port sea mecánico: cambia el import, no el contenido del archivo.
 *
 *   // antes (frc-mobile)
 *   import { Query } from 'apollo-angular';
 *
 *   // ahora
 *   import { Query } from 'src/app/core/graphql/gql-base';
 *
 * Ver docs/arquitectura/apollo-graphql.md.
 */

/**
 * Opciones por operación.
 *
 * Apollo Client 4 admite distintos conjuntos de `fetchPolicy` según el tipo
 * de operación —una mutation no puede leer de caché, por ejemplo—, así que
 * el tipo se estrecha en cada clase en vez de usar una unión común.
 */
export interface GqlOptions {
  fetchPolicy?: FetchPolicy;
  errorPolicy?: ErrorPolicy;
}

export interface GqlMutationOptions {
  fetchPolicy?: MutationFetchPolicy;
  errorPolicy?: ErrorPolicy;
}

/** Resultado normalizado, con la misma forma que exponía apollo-angular v7. */
export interface GqlResult<T> {
  data: T | null | undefined;
  errors?: readonly { message: string }[];
  loading: boolean;
}

/**
 * Política por defecto de toda operación.
 *
 * `no-cache` porque el backend es la fuente de verdad de saldos, stock y
 * estados: cachear lecturas mostraría datos viejos en pantallas donde eso
 * tiene consecuencias operativas. `errorPolicy: 'all'` para que un error
 * de GraphQL llegue en `errors` en vez de romper la suscripción.
 *
 * Una pantalla puede pasar otra política explícitamente.
 */
const DEFAULTS: Required<GqlOptions> = {
  fetchPolicy: 'no-cache',
  errorPolicy: 'all',
};

const DEFAULTS_MUTATION: Required<GqlMutationOptions> = {
  fetchPolicy: 'no-cache',
  errorPolicy: 'all',
};

@Injectable()
export abstract class Query<TData = unknown, TVariables extends object = Record<string, unknown>> {
  abstract document: DocumentNode;
  protected readonly apollo = inject(Apollo);

  fetch(variables?: TVariables, options?: GqlOptions): Observable<GqlResult<TData>> {
    return this.apollo
      .query<TData>({
        query: this.document,
        variables: variables as Record<string, unknown> | undefined,
        ...DEFAULTS,
        ...options,
      })
      .pipe(map((res) => normalizar<TData>(res)));
  }

  /** Equivalente a `watchQuery().valueChanges` de apollo-angular v7. */
  watch(variables?: TVariables, options?: GqlOptions): Observable<GqlResult<TData>> {
    return this.apollo
      .watchQuery<TData>({
        query: this.document,
        variables: variables as Record<string, unknown> | undefined,
        ...DEFAULTS,
        ...options,
      })
      .valueChanges.pipe(map((res) => normalizar<TData>(res)));
  }
}

@Injectable()
export abstract class Mutation<TData = unknown, TVariables extends object = Record<string, unknown>> {
  abstract document: DocumentNode;
  protected readonly apollo = inject(Apollo);

  mutate(variables?: TVariables, options?: GqlMutationOptions): Observable<GqlResult<TData>> {
    return this.apollo
      .mutate<TData>({
        mutation: this.document,
        variables: variables as Record<string, unknown> | undefined,
        ...DEFAULTS_MUTATION,
        ...options,
      })
      .pipe(map((res) => normalizar<TData>(res)));
  }
}

@Injectable()
export abstract class Subscription<TData = unknown, TVariables extends object = Record<string, unknown>> {
  abstract document: DocumentNode;
  protected readonly apollo = inject(Apollo);

  subscribe(variables?: TVariables, options?: GqlOptions): Observable<GqlResult<TData>> {
    return this.apollo
      .subscribe<TData>({
        query: this.document,
        variables: variables as Record<string, unknown> | undefined,
        // Los mismos defaults que query y mutation: sin `errorPolicy: 'all'`
        // un error de GraphQL mata el stream en vez de llegar en `errors`.
        ...DEFAULTS,
        ...options,
      })
      .pipe(map((res) => normalizar<TData>(res)));
  }
}

/**
 * Apollo Client 4 cambió la forma del resultado según la operación. Se
 * normaliza a `{data, errors, loading}` para que la capa de datos tenga un
 * único contrato.
 */
function normalizar<T>(res: unknown): GqlResult<T> {
  const r = res as {
    data?: T;
    error?: { message: string };
    errors?: readonly { message: string }[];
    loading?: boolean;
  };

  const errors = r.errors ?? (r.error ? [r.error] : undefined);

  return {
    data: r.data,
    errors: errors && errors.length > 0 ? errors : undefined,
    loading: r.loading ?? false,
  };
}
