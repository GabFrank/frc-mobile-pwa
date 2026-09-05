import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { EscanerService } from '../core/dispositivo/escaner.service';
import { DeleteCodigoGQL } from '../graphql/productos/deleteCodigo';
import { GenerarCodigoInternoGQL } from '../graphql/productos/generarCodigoInterno';
import { SaveCodigoGQL } from '../graphql/productos/saveCodigo';
import { CodigosPage } from '../pages/producto/editar/codigos.page';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';

/**
 * Marcar un código principal: la degradación tiene que terminar antes de que
 * arranque la promoción.
 *
 * Es la única regla de esta tarea que falla en silencio **en la base**: si el
 * nuevo se guardara antes de que el viejo se degrade, hay un instante con dos
 * principales y gana el que responda último — nada en la pantalla lo delata.
 * `toArray()` es la pieza que hace que el `concatMap` de la promoción espere a
 * que TODAS las degradaciones hayan terminado, no que dispare una vez por
 * cada una.
 */
describe('Marcar un código principal', () => {
  let datos: { guardar: ReturnType<typeof vi.fn>; consultar: ReturnType<typeof vi.fn> };
  let notificacion: { danger: ReturnType<typeof vi.fn> };
  let orden: string[];

  // Ids como string: así los manda el central (`ID` en el schema de
  // `Presentacion` y `Codigo`). Con esto el test ejercita también la
  // búsqueda de `presentacion()` contra el id de ruta — que es number, por
  // `idDeRutaNum` — y hubiera quedado `null` sin `mismoId()`.
  const presentacion = () => ({
    id: '10',
    cantidad: 1,
    codigos: [
      { id: '1', codigo: '779', principal: true, activo: true },
      { id: '2', codigo: '780', principal: false, activo: true },
    ],
  });

  const estado = {
    cargando: () => false,
    error: () => null,
    producto: () => ({ id: 1 }),
    presentaciones: () => [presentacion()],
    cargar: vi.fn(),
    recargar: vi.fn(),
  };

  beforeEach(() => {
    orden = [];
    notificacion = { danger: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProductoEditarService, useValue: estado },
        { provide: DialogoService, useValue: { confirmarEliminacion: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: notificacion },
        { provide: EscanerService, useValue: { escanear: vi.fn() } },
        { provide: SaveCodigoGQL, useValue: {} },
        { provide: DeleteCodigoGQL, useValue: {} },
        { provide: GenerarCodigoInternoGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(CodigosPage);
    f.componentRef.setInput('id', '1');
    f.componentRef.setInput('presentacionId', '10');
    f.detectChanges();
    return f;
  };

  it('degrada al principal anterior antes de guardar el nuevo', () => {
    datos = {
      guardar: vi.fn((_gql, input: { principal: boolean }) => {
        orden.push(input.principal ? 'promover' : 'degradar');
        return of({});
      }),
      consultar: vi.fn(),
    };
    const f = montar();

    const nuevo = f.componentInstance.codigos()[1]; // id '2', no principal
    f.componentInstance.marcarPrincipal(nuevo);

    expect(orden).toEqual(['degradar', 'promover']);

    // El código degradado es el que era principal, no el nuevo.
    const inputDegradado = datos.guardar.mock.calls[0][1];
    expect(inputDegradado.id).toBe('1');
    expect(inputDegradado.principal).toBe(false);

    const inputPromovido = datos.guardar.mock.calls[1][1];
    expect(inputPromovido.id).toBe('2');
    expect(inputPromovido.principal).toBe(true);
  });

  it('si la degradación falla, el nuevo código nunca se promueve', () => {
    datos = {
      guardar: vi.fn((_gql, input: { principal: boolean }) => {
        if (!input.principal) {
          return throwError(() => new Error('el central rechazó la degradación'));
        }
        orden.push('promover');
        return of({});
      }),
      consultar: vi.fn(),
    };
    const f = montar();

    const nuevo = f.componentInstance.codigos()[1];
    f.componentInstance.marcarPrincipal(nuevo);

    expect(orden).toEqual([]);
    expect(datos.guardar).toHaveBeenCalledTimes(1); // nunca llegó a intentar la promoción
    expect(notificacion.danger).toHaveBeenCalledTimes(1);
  });
});
