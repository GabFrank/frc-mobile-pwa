import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { DeletePrecioPorSucursalGQL } from '../graphql/productos/deletePrecioPorSucursal';
import { SavePrecioPorSucursalGQL } from '../graphql/productos/savePrecioPorSucursal';
import { TipoPreciosGQL } from '../graphql/productos/tipoPrecios';
import { PreciosPage, construirPrecioInput, esPrecioEditable } from '../pages/producto/editar/precios.page';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';
import { preciosADegradar } from '../pages/producto/editar/producto-editar.reglas';

describe('Editar un precio', () => {
  it('lo escribe en la sucursal de la sesión', () => {
    // El escritorio hace exactamente esto y no ofrece elegir:
    // adicionar-precio-dialog.component.ts:265.
    const input = construirPrecioInput(
      { id: null, precio: 12000, tipoPrecioId: 1, principal: true, activo: true },
      88,
      3,
    );
    expect(input.sucursalId).toBe(3);
    expect(input.presentacionId).toBe(88);
  });

  it('solo es editable el precio de la sucursal de la sesión', () => {
    // El `id` de `Sucursal` viaja como string (`ID` en el schema): un
    // fixture con ids `number` de los dos lados dejaría pasar un
    // `===` roto. `sucursalSesionId` sigue siendo number porque así lo
    // tipa la firma de `esPrecioEditable`.
    expect(esPrecioEditable({ sucursal: { id: '3' } }, 3)).toBe(true);
    expect(esPrecioEditable({ sucursal: { id: '7' } }, 3)).toBe(false);
  });

  it('un precio sin sucursal no es editable', () => {
    // «No sé de qué sucursal es» no es «es de la mía».
    expect(esPrecioEditable({ sucursal: undefined }, 3)).toBe(false);
  });

  it('degrada el principal anterior de esa presentación', () => {
    const precios = [
      { id: '1', precio: 12000, principal: true },
      { id: '2', precio: 11000, principal: false },
    ] as unknown as Parameters<typeof preciosADegradar>[0];
    expect(preciosADegradar(precios, 2).map((p) => p.id)).toEqual(['1']);
  });
});

/**
 * Precios con `tipoPrecioId = null`: 18 de 11.415 en la base real (0,2%).
 * `guardarEdicion`, `toggleActivo` y `marcarPrincipal` cortan antes de armar
 * el input porque `savePrecioPorSucursal` reemplaza la fila entera y un
 * `tipoPrecioId` inventado persistiría una clave ajena — pero cortar sin
 * avisar es el mismo bug que ya se corrigió dos veces en esta rama (la
 * degradación tragada y el catálogo reportado como cargado). Estos tests
 * verifican el aviso, no solo la ausencia de mutation.
 */
describe('Editar un precio sin tipo asignado', () => {
  let datos: { guardar: ReturnType<typeof vi.fn>; paginado: ReturnType<typeof vi.fn> };
  let notificacion: { danger: ReturnType<typeof vi.fn> };

  const sinTipo = () => ({
    id: 9,
    precio: 5000,
    principal: false,
    activo: true,
    tipoPrecio: undefined,
    sucursal: { id: 3 },
  });

  const estado = {
    cargando: () => false,
    error: () => null,
    producto: () => ({ id: 1 }),
    presentaciones: () => [{ id: 2, precios: [sinTipo()] }],
    cargar: vi.fn(),
    recargar: vi.fn(),
  };

  const montar = () => {
    datos = { guardar: vi.fn().mockReturnValue(of({})), paginado: vi.fn().mockReturnValue(of([])) };
    notificacion = { danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ProductoEditarService, useValue: estado },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: notificacion },
        { provide: AuthService, useValue: { sucursal: () => ({ id: 3 }), roles: () => [] } },
        { provide: SavePrecioPorSucursalGQL, useValue: {} },
        { provide: DeletePrecioPorSucursalGQL, useValue: {} },
        { provide: TipoPreciosGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
      ],
    });
    const f = TestBed.createComponent(PreciosPage);
    f.componentRef.setInput('id', '1');
    f.componentRef.setInput('presentacionId', '2');
    f.detectChanges();
    return f;
  };

  it('guardarEdicion avisa, no manda nada y libera la edición', () => {
    const f = montar();
    const p = f.componentInstance.preciosPropios()[0];
    f.componentInstance.iniciarEdicion(p);
    f.componentInstance.edicionValor.set(7000);

    f.componentInstance.guardarEdicion(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    // No se queda mostrando el valor nuevo como si se hubiera guardado.
    expect(f.componentInstance.edicionId()).toBeNull();
    expect(f.componentInstance.guardando()).toBe(false);
  });

  it('toggleActivo avisa y no manda nada', () => {
    const f = montar();
    const p = f.componentInstance.preciosPropios()[0];

    f.componentInstance.toggleActivo(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.guardando()).toBe(false);
  });

  it('marcarPrincipal avisa y no manda nada', () => {
    const f = montar();
    const p = f.componentInstance.preciosPropios()[0];

    f.componentInstance.marcarPrincipal(p);

    expect(datos.guardar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.guardando()).toBe(false);
  });
});
