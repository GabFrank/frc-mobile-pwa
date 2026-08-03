import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { AUTH_USER_ID_KEY } from '../auth/auth.tokens';
import { CargandoService } from '../ui/cargando.service';
import { NotificacionService } from '../ui/notificacion.service';
import type {
  GqlMutationOptions,
  GqlOptions,
  GqlResult,
  Mutation,
  Query,
  Subscription,
} from './gql-base';

/**
 * Capa de datos sobre Apollo. Reemplaza a `GenericCrudService` del repo
 * `frc-mobile`.
 *
 * ─── Qué cambia respecto del anterior ───────────────────────────────────
 *
 * 1 · **Los observables completan.** Allá ningún método llamaba
 *     `obs.complete()` salvo `onCustomSave`, así que un `firstValueFrom()`
 *     o un `await` nunca resolvía. (TODO_TECNICO #2)
 *
 * 2 · **Los errores se propagan.** Allá, ante un fallo, se mostraba el
 *     toast genérico "Ups!! Algo salió mal" y no se emitía nada — el
 *     llamador quedaba esperando para siempre y no podía distinguir "sin
 *     resultados" de "falló". Acá el error viaja por el canal de error.
 *
 * 3 · **Devuelve `Observable<T>` directo**, no `Promise<Observable<T>>`.
 *     Aquel envoltorio existía solo para poder `await` el diálogo de carga;
 *     ahora la carga es un signal y no hace falta.
 *
 * 4 · **`porFecha` calcula bien la fecha por defecto.** Allá usaba
 *     `getDay()` (día de la semana) en vez de `getDate()`, y el rango
 *     arrancaba en 1970. (TODO_TECNICO #1)
 *
 * ─── Lo que se mantiene ─────────────────────────────────────────────────
 *
 * · El alias `data:` en todas las operaciones GraphQL. Cambiarlo obligaría
 *   a tocar los ~296 documentos portados. Ver `docs/arquitectura/apollo-graphql.md`.
 * · La inyección automática de `usuarioId` al guardar.
 */
@Injectable({ providedIn: 'root' })
export class DatosService {
  private readonly notificacion = inject(NotificacionService);
  private readonly cargando = inject(CargandoService);

  // ─────────────────────────────────────────────────────────── Lecturas ──

  /** Consulta con variables libres. */
  consultar<T>(
    gql: Query<{ data?: T }>,
    variables?: Record<string, unknown>,
    opciones?: OpcionesOperacion,
  ): Observable<T> {
    return this.ejecutar(gql.fetch(variables, opciones?.gql), opciones);
  }

  /** Consulta por id. Manda `{ id, page, size, sucId }`. */
  porId<T>(
    gql: Query<{ data?: T }>,
    id: number,
    extra?: { page?: number; size?: number; sucId?: number },
    opciones?: OpcionesOperacion,
  ): Observable<T> {
    return this.consultar(gql, { id, ...extra }, opciones);
  }

  /** Consulta paginada. Manda `{ page, size }`. */
  paginado<T>(
    gql: Query<{ data?: T }>,
    page = 0,
    size = 20,
    extra?: Record<string, unknown>,
    opciones?: OpcionesOperacion,
  ): Observable<T> {
    return this.consultar(gql, { page, size, ...extra }, opciones);
  }

  /** Búsqueda por texto. Manda `{ texto }` y opcionalmente `{ sucId }`. */
  porTexto<T>(
    gql: Query<{ data?: T }>,
    texto: string,
    sucId?: number,
    opciones?: OpcionesOperacion,
  ): Observable<T> {
    return this.consultar(gql, sucId != null ? { texto, sucId } : { texto }, opciones);
  }

  /**
   * Consulta por rango de fechas.
   *
   * Si no se pasa `fin`, se toma ahora. Si no se pasa `inicio`, se toma el
   * comienzo del día anterior. El repo previo calculaba mal ese default y
   * devolvía un rango que arrancaba en 1970.
   */
  porFecha<T>(
    gql: Query<{ data?: T }>,
    inicio?: Date | null,
    fin?: Date | null,
    opciones?: OpcionesOperacion,
  ): Observable<T> {
    const hasta = fin ?? new Date();

    let desde: Date;
    if (inicio) {
      desde = inicio;
    } else {
      desde = new Date(hasta);
      desde.setDate(hasta.getDate() - 1);
      desde.setHours(0, 0, 0, 0);
    }

    if (desde > hasta) {
      return throwError(
        () => new Error('El inicio del rango es posterior al fin.'),
      );
    }

    return this.consultar(gql, { inicio: desde, fin: hasta }, opciones);
  }

  // ─────────────────────────────────────────────────────────── Escrituras ──

  /**
   * Guarda una entidad. Manda `{ entity, sucId }`.
   *
   * Completa `usuarioId` con el usuario en sesión si el input no lo trae.
   * No lo pises salvo que quieras atribuir la operación a otro usuario.
   */
  guardar<T>(
    gql: Mutation<{ data?: T }>,
    input: Record<string, unknown>,
    sucId?: number,
    opciones?: OpcionesMutacion,
  ): Observable<T> {
    const entity = { ...input };
    if (entity['usuarioId'] == null) {
      const usuarioId = this.usuarioIdEnSesion();
      if (usuarioId != null) {
        entity['usuarioId'] = usuarioId;
      }
    }

    return this.ejecutar(gql.mutate({ entity, sucId }, opciones?.gql), {
      mensajeExito: 'Guardado',
      ...opciones,
    });
  }

  /** Guarda cabecera + detalle. Manda `{ entity, detalleList }`. */
  guardarConDetalle<T>(
    gql: Mutation<{ data?: T }>,
    entity: Record<string, unknown>,
    detalleList: unknown[],
    opciones?: OpcionesMutacion,
  ): Observable<T> {
    const cabecera = { ...entity };
    if (cabecera['usuarioId'] == null) {
      const usuarioId = this.usuarioIdEnSesion();
      if (usuarioId != null) {
        cabecera['usuarioId'] = usuarioId;
      }
    }

    return this.ejecutar(gql.mutate({ entity: cabecera, detalleList }, opciones?.gql), {
      mensajeExito: 'Guardado',
      ...opciones,
    });
  }

  /** Mutation con variables libres. */
  mutar<T>(
    gql: Mutation<{ data?: T }>,
    variables?: Record<string, unknown>,
    opciones?: OpcionesMutacion,
  ): Observable<T> {
    return this.ejecutar(gql.mutate(variables, opciones?.gql), opciones);
  }

  /**
   * Elimina por id. Manda `{ id }`.
   *
   * A diferencia del repo anterior, **no abre el diálogo de confirmación**:
   * eso es responsabilidad de la pantalla, vía `DialogoService`. Mezclar
   * confirmación y transporte hacía imposible eliminar sin preguntar.
   */
  eliminar(
    gql: Mutation<{ data?: boolean }>,
    id: number,
    opciones?: OpcionesMutacion,
  ): Observable<boolean> {
    return this.ejecutar(gql.mutate({ id }, opciones?.gql), {
      mensajeExito: 'Eliminado',
      ...opciones,
    }).pipe(map((ok) => ok === true));
  }

  // ───────────────────────────────────────────────────────── Suscripciones ──

  suscribir<T>(
    gql: Subscription<{ data?: T }>,
    variables?: Record<string, unknown>,
  ): Observable<T> {
    return gql.subscribe(variables).pipe(map((res) => this.extraer(res)));
  }

  // ──────────────────────────────────────────────────────────────── Interno ──

  private ejecutar<T>(
    origen: Observable<GqlResult<{ data?: T }>>,
    opciones?: OpcionesOperacion | OpcionesMutacion,
  ): Observable<T> {
    if (opciones?.mostrarCarga !== false) {
      this.cargando.iniciar();
    }

    return origen.pipe(
      map((res) => {
        if (res.errors?.length) {
          throw new ErrorDatos(res.errors.map((e) => e.message).join(' · '));
        }
        return this.extraer(res);
      }),
      tap(() => {
        if (opciones?.mensajeExito) {
          this.notificacion.ok(opciones.mensajeExito);
        }
      }),
      catchError((err: unknown) => {
        const mensaje = mensajeDeError(err);
        if (opciones?.notificarError !== false) {
          this.notificacion.danger(mensaje);
        }
        return throwError(() => new ErrorDatos(mensaje, err));
      }),
      finalize(() => {
        if (opciones?.mostrarCarga !== false) {
          this.cargando.finalizar();
        }
      }),
    );
  }

  /**
   * Desenvuelve el alias `data:`.
   *
   * Toda operación GraphQL del proyecto aliasea su campo raíz a `data`. Si
   * falta el alias, la respuesta llega sin esa clave y antes eso producía
   * `undefined` en silencio. Acá se detecta y se avisa.
   */
  private extraer<T>(res: GqlResult<{ data?: T }>): T {
    const payload = res.data;
    if (payload == null) {
      return null as T;
    }
    if (!('data' in payload)) {
      throw new ErrorDatos(
        'La operación GraphQL no aliasea su campo raíz a `data`. ' +
          'Ver docs/arquitectura/apollo-graphql.md.',
      );
    }
    return payload.data as T;
  }

  private usuarioIdEnSesion(): number | null {
    const crudo = localStorage.getItem(AUTH_USER_ID_KEY);
    if (!crudo || crudo === 'null') {
      return null;
    }
    const id = Number(crudo);
    return Number.isFinite(id) ? id : null;
  }
}

export interface OpcionesOperacion {
  /** Suma la operación al contador de carga global. Por defecto `true`. */
  mostrarCarga?: boolean;
  /** Muestra un toast de error. Por defecto `true`. */
  notificarError?: boolean;
  /** Si se pasa, muestra un toast de éxito con ese texto. */
  mensajeExito?: string;
  /** Política de caché de Apollo para esta operación puntual. */
  gql?: GqlOptions;
}

/** Igual que `OpcionesOperacion`, con las políticas válidas para mutations. */
export interface OpcionesMutacion extends Omit<OpcionesOperacion, 'gql'> {
  gql?: GqlMutationOptions;
}

/** Error de la capa de datos, con el mensaje ya listo para mostrar. */
export class ErrorDatos extends Error {
  constructor(
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorDatos';
  }
}

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorDatos) {
    return err.message;
  }
  if (err instanceof Error) {
    // Un fallo de red no tiene mensaje útil para el usuario.
    if (/failed to fetch|networkerror|err_connection/i.test(err.message)) {
      return 'No se pudo conectar con el servidor. Verificá la conexión.';
    }
    return err.message;
  }
  return 'Ocurrió un error inesperado.';
}
