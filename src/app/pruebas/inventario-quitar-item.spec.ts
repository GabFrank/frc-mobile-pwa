import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { InventarioCargaPage } from '../pages/inventario/inventario-carga.page';
import { InventarioService } from '../pages/inventario/inventario.service';
import { ProductoService } from '../pages/producto/producto.service';

/**
 * Sacar un renglón del conteo.
 *
 * ⚠️ **Borra de verdad**: el central hace `deleteById` y lo contado en ese
 * renglón se pierde. El caso de uso es el renglón agregado por error —el
 * producto que no era, o la presentación equivocada—, no deshacer un conteo.
 */
describe('Quitar un producto del conteo', () => {
  let servicio: {
    porId: ReturnType<typeof vi.fn>;
    guardarItem: ReturnType<typeof vi.fn>;
    borrarItem: ReturnType<typeof vi.fn>;
  };
  let dialogo: { abrir: ReturnType<typeof vi.fn>; confirmarEliminacion: ReturnType<typeof vi.fn> };
  let notificacion: {
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    ok: ReturnType<typeof vi.fn>;
  };

  const inventario = (estado: InventarioEstado) => ({
    id: 5,
    estado,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      {
        id: 91,
        zona: { id: 11, descripcion: 'gondola 3' },
        inventarioProductoItemList: [
          {
            id: 61,
            cantidadFisica: 70,
            presentacion: { id: 9, cantidad: 1, descripcion: 'unidad', producto: { id: 200, descripcion: 'COCA COLA 500ML' } },
          },
          {
            id: 62,
            cantidadFisica: 12,
            presentacion: { id: 8, cantidad: 6, descripcion: 'caja x 6', producto: { id: 300, descripcion: 'CORONITA EXTRA' } },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario(InventarioEstado.ABIERTO))),
      guardarItem: vi.fn(() => of({ id: 61 })),
      borrarItem: vi.fn(() => of(true)),
    };
    dialogo = { abrir: vi.fn(), confirmarEliminacion: vi.fn(async () => true) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: ProductoService, useValue: { vencimientosConocidos: vi.fn(() => of([])) } },
        { provide: ProductoBusquedaService, useValue: { stock: vi.fn(() => of(0)) } },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
        {
          provide: AuthService,
          useValue: { usuario: signal({ id: 41 }), sucursal: signal({ id: 3 }), roles: signal([]) },
        },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(InventarioCargaPage);
    f.componentRef.setInput('id', '5');
    f.componentRef.setInput('productoId', '91');
    f.detectChanges();
    return f;
  };

  it('confirma antes de borrar, nombrando el producto y su presentación', async () => {
    const f = montar();
    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    const texto = dialogo.confirmarEliminacion.mock.calls[0][0] as string;
    // Dos renglones pueden ser del mismo producto: sin la presentación, el
    // aviso no dice cuál de los dos se va.
    expect(texto).toContain('COCA COLA 500ML');
    expect(texto).toContain('unidad');
    expect(servicio.borrarItem).toHaveBeenCalledWith(61);
  });

  it('cancelar no borra nada', async () => {
    dialogo.confirmarEliminacion = vi.fn(async () => false);
    const f = montar();
    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    expect(servicio.borrarItem).not.toHaveBeenCalled();
  });

  it('lo editado de ese renglón deja de contar para Guardar', async () => {
    // Si quedara en el mapa de edición, «Guardar conteo (n)» lo seguiría
    // contando y el guardado fallaría contra un id que el central ya no tiene.
    const f = montar();
    f.componentInstance.cambiarContado(61, { target: { value: '7' } } as unknown as Event);
    expect(f.componentInstance.hayCambios()).toBe(true);

    servicio.porId = vi.fn(() =>
      of({
        ...inventario(InventarioEstado.ABIERTO),
        inventarioProductoList: [
          {
            id: 91,
            zona: { id: 11, descripcion: 'gondola 3' },
            inventarioProductoItemList: [
              {
                id: 62,
                cantidadFisica: 12,
                presentacion: { id: 8, cantidad: 6, descripcion: 'caja x 6', producto: { id: 300, descripcion: 'CORONITA EXTRA' } },
              },
            ],
          },
        ],
      }),
    );
    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    expect(f.componentInstance.hayCambios()).toBe(false);
    expect(f.componentInstance.items().length).toBe(1);
  });

  it('si el renglón borrado estaba abierto, la tarjeta se cierra', async () => {
    const f = montar();
    f.componentInstance.alternar(61);
    expect(f.componentInstance.abiertoId()).toBe(61);

    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    expect(f.componentInstance.abiertoId()).toBeNull();
  });

  it('con la toma cerrada no se puede quitar nada', async () => {
    // El alcance de una toma cerrada ya es un hecho histórico: sacarle un
    // renglón cambiaría qué se contó en una toma que ya ajustó stock.
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO)));
    const f = montar();

    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    expect(dialogo.confirmarEliminacion).not.toHaveBeenCalled();
    expect(servicio.borrarItem).not.toHaveBeenCalled();
  });

  it('el menú de quitar aparece solo con la toma abierta', () => {
    const f = montar();
    expect(f.componentInstance.puedeAgregar()).toBe(true);
    expect(f.nativeElement.querySelectorAll('.menu-btn').length).toBe(2);

    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO)));
    const cerrada = montar();
    expect(cerrada.nativeElement.querySelectorAll('.menu-btn').length).toBe(0);
  });

  it('si el central rechaza el borrado, se dice y no se pierde la pantalla', async () => {
    servicio.borrarItem = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();

    await f.componentInstance.quitarItem(f.componentInstance.items()[0]);

    expect(notificacion.danger).toHaveBeenCalledWith('sin conexión');
    expect(f.componentInstance.items().length).toBe(2);
  });
});
