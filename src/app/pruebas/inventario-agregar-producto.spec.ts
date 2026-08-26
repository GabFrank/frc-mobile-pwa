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
import { ProductoService } from '../pages/producto/producto.service';
import { InventarioCargaPage } from '../pages/inventario/inventario-carga.page';
import { InventarioService } from '../pages/inventario/inventario.service';

/**
 * Sumar a la zona un producto que la toma no incluía.
 *
 * Reusa el buscador que ya existe —descripción, código, cámara y códigos de
 * balanza—; lo que se prueba acá es qué se guarda con lo que devuelve.
 */
describe('Agregar un producto al conteo', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; guardarItem: ReturnType<typeof vi.fn> };
  let busqueda: { stock: ReturnType<typeof vi.fn> };
  let productos: { vencimientosConocidos: ReturnType<typeof vi.fn> };
  let dialogo: { abrir: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };

  const inventario = (estado: InventarioEstado, items: unknown[] = []) => ({
    id: 5,
    estado,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      {
        id: 91,
        concluido: false,
        zona: { id: 11, descripcion: 'estante alto' },
        inventarioProductoItemList: items,
      },
    ],
  });

  const SELECCION = {
    producto: { id: 200, descripcion: 'COCA COLA 2L' },
    presentacion: { id: 9, cantidad: 1 },
  };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario(InventarioEstado.ABIERTO))),
      guardarItem: vi.fn(() => of({ id: 500 })),
    };
    // Un stock que no coincide con ningún otro número del test: si la
    // pantalla leyera otro campo, se vería.
    busqueda = { stock: vi.fn(() => of(42)) };
    productos = { vencimientosConocidos: vi.fn(() => of([])) };
    dialogo = { abrir: vi.fn(async () => SELECCION) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: ProductoService, useValue: productos },
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

  it('el botón está con la zona vacía, que es cuando más hace falta', () => {
    const f = montar();
    expect(f.nativeElement.textContent).toContain('Agregar producto');
  });

  it('con la toma cerrada no se puede agregar', () => {
    // El alcance de una toma cerrada ya es un hecho histórico.
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO)));
    const f = montar();
    expect(f.componentInstance.puedeAgregar()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('Agregar producto');
  });

  it('el stock del sistema va a cantidadFisica y el conteo queda vacío', async () => {
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(busqueda.stock).toHaveBeenCalledWith(200, 3);
    expect(servicio.guardarItem).toHaveBeenCalledWith({
      inventarioProductoId: 91,
      presentacionId: 9,
      cantidadFisica: 42,
      cantidadAnterior: 42,
      usuarioId: 41,
      verificado: false,
      revisado: false,
    });
  });

  it('el buscador recibe la sucursal de la toma, para mostrar su stock', async () => {
    const f = montar();
    await f.componentInstance.agregarProducto();

    const datos = dialogo.abrir.mock.calls[0][1] as { opciones: { sucursalId: number; devuelve: string } };
    expect(datos.opciones.sucursalId).toBe(3);
    expect(datos.opciones.devuelve).toBe('presentacion');
  });

  it('un peso de balanza entra como lo contado', async () => {
    dialogo.abrir = vi.fn(async () => ({ ...SELECCION, peso: 1.235 }));
    const f = montar();
    await f.componentInstance.agregarProducto();

    const input = servicio.guardarItem.mock.calls[0][0];
    expect(input.cantidad).toBe(1.235);
    expect(input.cantidadFisica).toBe(42);
  });

  it('el renglón duplicado lo rechaza el central, y la pantalla muestra su mensaje', async () => {
    // ⚠️ **La regla no vive en el cliente.** Qué es un renglón repetido —misma
    // zona, misma presentación, mismo vencimiento— lo decide
    // `InventarioProductoItemService.save()`. Tener una copia acá es lo que
    // produjo el defecto que este test cuida: la copia local decía
    // (zona, presentación) y el central (inventario, producto, vencimiento),
    // así que agregar un producto que ya estaba en OTRA zona pasaba el chequeo
    // del cliente y moría en el servidor con un texto de Java en pantalla.
    const delCentral = 'Esa presentacion ya esta en la zona estante alto con el mismo vencimiento.';
    servicio.guardarItem = vi.fn(() => throwError(() => new Error(delCentral)));
    const f = montar();
    await f.componentInstance.agregarProducto();

    // Tal cual como vino: el central lo manda escrito para el operador, y
    // reescribirlo acá sería volver a tener la regla en dos lados.
    expect(notificacion.danger).toHaveBeenCalledWith(delCentral);
  });

  it('otra presentación del mismo producto se manda, sin frenarla', async () => {
    // «Unidad» y «caja x12» son dos renglones legítimos y el central los
    // acepta. Frenarlo en el cliente sería reponer la regla que se sacó.
    servicio.porId = vi.fn(() =>
      of(
        inventario(InventarioEstado.ABIERTO, [
          { id: 1, presentacion: { id: 8, producto: { id: 200 } } },
        ]),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).toHaveBeenCalled();
  });

  it('la misma presentación que ya está en la zona también se manda', async () => {
    // Puede ser un lote nuevo con otra fecha, que es legítimo. Decidirlo es
    // del central; el cliente ya no adivina.
    servicio.porId = vi.fn(() =>
      of(
        inventario(InventarioEstado.ABIERTO, [
          { id: 1, vencimiento: '2026-11-20', presentacion: { id: 9, producto: { id: 200 } } },
        ]),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).toHaveBeenCalled();
  });

  it('cerrar el buscador sin elegir no guarda nada', async () => {
    dialogo.abrir = vi.fn(async () => undefined);
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).not.toHaveBeenCalled();
  });

  it('si no se pudo consultar el stock, no se agrega con un cero inventado', async () => {
    busqueda.stock = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(notificacion.danger).toHaveBeenCalledWith('sin conexión');
    expect(servicio.guardarItem).not.toHaveBeenCalled();
  });
});
