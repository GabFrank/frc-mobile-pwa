import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CargandoService } from '../ui/cargando.service';
import { NotificacionService } from '../ui/notificacion.service';
import { AUTH_USER_ID_KEY } from '../auth/auth.tokens';
import { DatosService, ErrorDatos } from './datos.service';
import type { GqlResult, Mutation, Query } from './gql-base';

/** Doble de una operación GraphQL: devuelve lo que se le indique. */
function queryFalsa<T>(payload: T) {
  const resultado = { data: { data: payload }, loading: false } as GqlResult<{ data?: T }>;
  return {
    document: {} as never,
    fetch: vi.fn((_v?: unknown, _o?: unknown) => of(resultado)),
    watch: vi.fn((_v?: unknown, _o?: unknown) => of(resultado)),
  } as unknown as Query<{ data?: T }>;
}

function queryQueFalla(error: Error) {
  return {
    document: {} as never,
    fetch: vi.fn(() => throwError(() => error)),
    watch: vi.fn(() => throwError(() => error)),
  } as unknown as Query<{ data?: unknown }>;
}

/** Recibe el payload y lo envuelve en la forma que devuelve el shim. */
function mutationFalsa<T>(payload: T) {
  const mutate = vi.fn((_vars?: unknown, _op?: unknown) =>
    of({ data: { data: payload }, loading: false } as GqlResult<{ data?: T }>),
  );
  return {
    objeto: { document: {} as never, mutate } as unknown as Mutation<{ data?: T }>,
    mutate,
  };
}

describe('DatosService', () => {
  let datos: DatosService;
  let notificacion: { ok: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let cargando: CargandoService;

  beforeEach(() => {
    notificacion = { ok: vi.fn(), danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        DatosService,
        CargandoService,
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
    datos = TestBed.inject(DatosService);
    cargando = TestBed.inject(CargandoService);
    localStorage.clear();
  });

  describe('consultar', () => {
    it('desenvuelve el alias `data` y completa', async () => {
      const emitidos: unknown[] = [];
      let completo = false;

      await new Promise<void>((resolve) => {
        datos.consultar(queryFalsa({ id: 7 }), undefined, { mostrarCarga: false }).subscribe({
          next: (v) => emitidos.push(v),
          // El repo anterior nunca completaba: un await quedaba colgado.
          complete: () => {
            completo = true;
            resolve();
          },
        });
      });

      expect(emitidos).toEqual([{ id: 7 }]);
      expect(completo).toBe(true);
    });

    it('propaga el error en vez de tragárselo', async () => {
      const capturado = await new Promise<Error | null>((resolve) => {
        datos
          .consultar(queryQueFalla(new Error('sin red')), undefined, { mostrarCarga: false })
          .subscribe({
            next: () => resolve(null),
            error: (e: Error) => resolve(e),
          });
      });

      expect(capturado).toBeInstanceOf(ErrorDatos);
      expect(notificacion.danger).toHaveBeenCalled();
    });

    it('convierte errores de GraphQL en error del observable', async () => {
      const conErrores = {
        document: {} as never,
        fetch: () =>
          of({
            data: { data: null },
            errors: [{ message: 'campo inválido' }],
            loading: false,
          } as GqlResult<{ data?: unknown }>),
      } as never;

      const capturado = await new Promise<Error>((resolve) => {
        datos
          .consultar(conErrores, undefined, { mostrarCarga: false, notificarError: false })
          .subscribe({ error: (e: Error) => resolve(e) });
      });

      expect(capturado).toBeInstanceOf(ErrorDatos);
      expect(capturado.message).toContain('campo inválido');
    });

    it('detecta que la operación no aliasea su raíz a `data`', async () => {
      const sinAlias = {
        document: {} as never,
        fetch: () => of({ data: { otroNombre: 1 }, loading: false }),
      } as never;

      const capturado = await new Promise<Error>((resolve) => {
        datos
          .consultar(sinAlias, undefined, { mostrarCarga: false, notificarError: false })
          .subscribe({ error: (e: Error) => resolve(e) });
      });

      // En frc-mobile esto daba undefined en silencio.
      expect(capturado.message).toContain('alias');
    });

    it('libera el contador de carga aunque falle', async () => {
      await new Promise<void>((resolve) => {
        datos.consultar(queryQueFalla(new Error('x')), undefined, { notificarError: false }).subscribe({
          error: () => resolve(),
        });
      });
      expect(cargando.cargando()).toBe(false);
    });
  });

  describe('porFecha', () => {
    it('usa el día anterior cuando no se pasa inicio', async () => {
      const gql = queryFalsa<unknown[]>([]);
      await new Promise<void>((resolve) => {
        datos.porFecha(gql, null, new Date('2026-08-03T15:00:00'), { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });

      const vars = (gql.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
        inicio: Date;
      };
      // El repo anterior usaba getDay() y producía una fecha de 1970.
      expect(vars.inicio.getFullYear()).toBe(2026);
      expect(vars.inicio.getDate()).toBe(2);
      expect(vars.inicio.getHours()).toBe(0);
    });

    it('rechaza un rango invertido antes de ir al servidor', async () => {
      const gql = queryFalsa<unknown[]>([]);
      const error = await new Promise<Error>((resolve) => {
        datos
          .porFecha(gql, new Date('2026-08-10'), new Date('2026-08-01'))
          .subscribe({ error: (e: Error) => resolve(e) });
      });
      expect(error.message).toContain('posterior');
      expect(gql.fetch).not.toHaveBeenCalled();
    });
  });

  describe('guardar', () => {
    it('completa usuarioId desde la sesión', async () => {
      localStorage.setItem(AUTH_USER_ID_KEY, '42');
      const { objeto, mutate } = mutationFalsa({ id: 1 });

      await new Promise<void>((resolve) => {
        datos.guardar(objeto, { nombre: 'X' }, undefined, { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });

      const vars = mutate.mock.calls[0]![0] as { entity: Record<string, unknown> };
      expect(vars.entity['usuarioId']).toBe(42);
    });

    it('respeta el usuarioId que ya venga en el input', async () => {
      localStorage.setItem(AUTH_USER_ID_KEY, '42');
      const { objeto, mutate } = mutationFalsa({ id: 1 });

      await new Promise<void>((resolve) => {
        datos.guardar(objeto, { usuarioId: 99 }, undefined, { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });

      const vars = mutate.mock.calls[0]![0] as { entity: Record<string, unknown> };
      expect(vars.entity['usuarioId']).toBe(99);
    });

    it('ignora la clave "null" que dejaba el repo anterior', async () => {
      localStorage.setItem(AUTH_USER_ID_KEY, 'null');
      const { objeto, mutate } = mutationFalsa({ id: 1 });

      await new Promise<void>((resolve) => {
        datos.guardar(objeto, { nombre: 'X' }, undefined, { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });

      const vars = mutate.mock.calls[0]![0] as { entity: Record<string, unknown> };
      expect(vars.entity['usuarioId']).toBeUndefined();
    });

    it('no muta el input que recibe', async () => {
      localStorage.setItem(AUTH_USER_ID_KEY, '42');
      const { objeto } = mutationFalsa({ id: 1 });
      const input = { nombre: 'X' };

      await new Promise<void>((resolve) => {
        datos.guardar(objeto, input, undefined, { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });

      expect(input).toEqual({ nombre: 'X' });
    });

    it('avisa el éxito', async () => {
      const { objeto } = mutationFalsa({ id: 1 });
      await new Promise<void>((resolve) => {
        datos.guardar(objeto, {}, undefined, { mostrarCarga: false })
          .subscribe({ complete: () => resolve() });
      });
      expect(notificacion.ok).toHaveBeenCalledWith('Guardado');
    });
  });

  describe('eliminar', () => {
    it('devuelve booleano y no abre ningún diálogo', async () => {
      const { objeto, mutate } = mutationFalsa(true);
      const resultado = await new Promise<boolean>((resolve) => {
        datos.eliminar(objeto as never, 5, { mostrarCarga: false }).subscribe({ next: resolve });
      });
      expect(resultado).toBe(true);
      expect(mutate.mock.calls[0]![0]).toEqual({ id: 5 });
    });
  });
});
