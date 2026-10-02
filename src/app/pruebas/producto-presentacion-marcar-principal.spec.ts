import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { DeletePresentacionGQL } from '../graphql/productos/deletePresentacion';
import { SavePresentacionGQL } from '../graphql/productos/savePresentacion';
import { TiposPresentacionGQL } from '../graphql/productos/tiposPresentacion';
import { PresentacionEditarPage } from '../pages/producto/editar/presentacion-editar.page';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';

/**
 * Marcar una presentación «Principal»: la degradación de las demás tiene que
 * terminar antes de que arranque el guardado de la nueva.
 *
 * Es el hallazgo #1 de la revisión final: sin esto, «Unidad (principal)» y
 * «Caja x12» pueden quedar las dos con `principal = true`, y
 * `presentacionPorCodigo()` (`presentacion.util.ts`) desempata por orden de
 * lista, no por ninguna regla de negocio.
 */
describe('Marcar una presentación principal', () => {
  let datos: { guardar: ReturnType<typeof vi.fn>; paginado: ReturnType<typeof vi.fn> };
  let notificacion: { danger: ReturnType<typeof vi.fn> };
  let orden: string[];

  const unidad = () => ({ id: 1, descripcion: 'Unidad', cantidad: 1, principal: true, activo: true });
  const caja = () => ({ id: 2, descripcion: 'Caja x12', cantidad: 12, principal: false, activo: true });

  const estado = {
    cargando: () => false,
    error: () => null,
    producto: () => ({ id: 1 }),
    presentaciones: () => [unidad(), caja()],
    cargar: vi.fn(),
    recargar: vi.fn(),
  };

  beforeEach(() => {
    orden = [];
    notificacion = { danger: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ProductoEditarService, useValue: estado },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: notificacion },
        { provide: AuthService, useValue: { sucursal: () => null, roles: () => [] } },
        { provide: SavePresentacionGQL, useValue: {} },
        { provide: DeletePresentacionGQL, useValue: {} },
        { provide: TiposPresentacionGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(PresentacionEditarPage);
    f.componentRef.setInput('id', '1');
    f.componentRef.setInput('presentacionId', '2');
    f.detectChanges();
    return f;
  };

  it('degrada a la principal anterior antes de guardar la nueva', () => {
    datos = {
      guardar: vi.fn((_gql, input: { id: number; principal: boolean }) => {
        orden.push(input.principal ? 'promover' : 'degradar');
        return of({});
      }),
      paginado: vi.fn().mockReturnValue(of([])),
    };
    const f = montar();

    f.componentInstance.principal.set(true);
    f.componentInstance.guardar();

    expect(orden).toEqual(['degradar', 'promover']);

    const inputDegradado = datos.guardar.mock.calls[0][1];
    expect(inputDegradado.id).toBe(1);
    expect(inputDegradado.principal).toBe(false);

    const inputPromovido = datos.guardar.mock.calls[1][1];
    expect(inputPromovido.id).toBe(2);
    expect(inputPromovido.principal).toBe(true);
  });

  it('si la degradación falla, la nueva presentación nunca se promueve', () => {
    datos = {
      guardar: vi.fn((_gql, input: { principal: boolean }) => {
        if (!input.principal) {
          return throwError(() => new Error('el central rechazó la degradación'));
        }
        orden.push('promover');
        return of({});
      }),
      paginado: vi.fn().mockReturnValue(of([])),
    };
    const f = montar();

    f.componentInstance.principal.set(true);
    f.componentInstance.guardar();

    expect(orden).toEqual([]);
    expect(datos.guardar).toHaveBeenCalledTimes(1); // nunca llegó a intentar la promoción
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
  });

  it('sin marcar principal, guarda directo sin degradar nada', () => {
    datos = {
      guardar: vi.fn().mockReturnValue(of({})),
      paginado: vi.fn().mockReturnValue(of([])),
    };
    const f = montar();

    f.componentInstance.principal.set(false);
    f.componentInstance.guardar();

    expect(datos.guardar).toHaveBeenCalledTimes(1);
    expect(datos.guardar.mock.calls[0][1].principal).toBe(false);
  });
});
