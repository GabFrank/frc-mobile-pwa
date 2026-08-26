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
  let productos: { vencidos: ReturnType<typeof vi.fn> };
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
    productos = { vencidos: vi.fn(() => of({ getContent: [] })) };
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

  it('una presentación que ya está en la zona no se duplica', async () => {
    // El central suma los dos renglones al finalizar: el conteo saldría doble.
    servicio.porId = vi.fn(() =>
      of(
        inventario(InventarioEstado.ABIERTO, [
          { id: 1, vencimiento: '2026-11-20', presentacion: { id: 9, producto: { id: 200 } } },
        ]),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(notificacion.warn).toHaveBeenCalled();
    expect(servicio.guardarItem).not.toHaveBeenCalled();
  });

  it('otra presentación del mismo producto entra si la que ya está tiene fecha', async () => {
    // «Unidad» y «caja x12» son dos ítems legítimos del producto. El central
    // los acepta mientras los vencimientos NO sean iguales.
    servicio.porId = vi.fn(() =>
      of(
        inventario(InventarioEstado.ABIERTO, [
          { id: 1, vencimiento: '2026-11-20', presentacion: { id: 8, producto: { id: 200 } } },
        ]),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).toHaveBeenCalled();
  });

  it('otra presentación del mismo producto SIN fecha se frena antes de mandarla', async () => {
    // El central compara por producto y toma dos vencimientos nulos por
    // iguales, así que esto volvía como excepción de Java en pantalla.
    servicio.porId = vi.fn(() =>
      of(
        inventario(InventarioEstado.ABIERTO, [
          { id: 1, presentacion: { id: 8, producto: { id: 200 } } },
        ]),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).not.toHaveBeenCalled();
    expect(notificacion.warn).toHaveBeenCalled();
  });

  it('el mismo producto en otra zona de la toma se frena, diciendo en cuál', async () => {
    // El error reportado: la guarda vieja solo miraba la zona actual.
    servicio.porId = vi.fn(() =>
      of({
        id: 5,
        estado: InventarioEstado.ABIERTO,
        sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
        inventarioProductoList: [
          { id: 91, concluido: false, zona: { id: 11, descripcion: 'estante alto' }, inventarioProductoItemList: [] },
          {
            id: 92,
            concluido: false,
            zona: { id: 12, descripcion: 'gondola 2' },
            inventarioProductoItemList: [{ id: 7, presentacion: { id: 9, producto: { id: 200 } } }],
          },
        ],
      }),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).not.toHaveBeenCalled();
    // Sin decir dónde está, el aviso no le sirve de nada al operador.
    expect(notificacion.warn.mock.calls[0][0]).toContain('gondola 2');
  });

  it('si el central rechaza igual, no se muestra el texto de la excepción', async () => {
    // Otro teléfono puede agregarlo entre la consulta y el guardado.
    servicio.guardarItem = vi.fn(() =>
      throwError(
        () => new Error('El producto ya fue registrado en este inventario con el mismo vencimiento'),
      ),
    );
    const f = montar();
    await f.componentInstance.agregarProducto();

    const mensaje = notificacion.danger.mock.calls[0][0] as string;
    expect(mensaje).not.toContain('ya fue registrado en este inventario');
    expect(mensaje).toContain('Buscalo en las zonas de la toma');
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
