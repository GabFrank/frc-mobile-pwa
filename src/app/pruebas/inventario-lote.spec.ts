import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import { EstadoLote } from '../domains/lote/lote.model';
import { LoteService } from '../domains/lote/lote.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { ProductoService } from '../pages/producto/producto.service';
import { InventarioCargaPage } from '../pages/inventario/inventario-carga.page';
import { InventarioService } from '../pages/inventario/inventario.service';

/**
 * Contar un producto CON control de lote.
 *
 * Lo que cambia respecto del conteo normal es qué **es** un renglón: con lote,
 * un renglón es un lote y `cantidadFisica` es el saldo DE ESE LOTE, no la
 * existencia del producto. Y las fechas dejan de ser del renglón: viven en el
 * maestro del lote, que es uno solo en toda la red.
 */
describe('Conteo por lote', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; guardarItem: ReturnType<typeof vi.fn> };
  let busqueda: { stock: ReturnType<typeof vi.fn> };
  let productos: { vencimientosConocidos: ReturnType<typeof vi.fn> };
  let dialogo: { abrir: ReturnType<typeof vi.fn> };
  let notificacion: {
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    ok: ReturnType<typeof vi.fn>;
  };
  let lotes: {
    stockPorLote: ReturnType<typeof vi.fn>;
    buscar: ReturnType<typeof vi.fn>;
    actualizarFechas: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
  };

  /** Un producto con control de lote. El buscador lo devuelve con `lote: true`. */
  const SELECCION = {
    producto: { id: 200, descripcion: 'PILSEN CLASICA LATA', lote: true },
    presentacion: { id: 9, cantidad: 1 },
  };

  /** Dos lotes con saldo, con números que no se parecen a ningún otro del test. */
  const STOCK_POR_LOTE = [
    { loteId: 41, numeroLote: 'L-2026-88', cantidadDisponible: 24, fechaVencimiento: '2026-12-01' },
    { loteId: 42, numeroLote: 'L-2026-91', cantidadDisponible: 13, fechaVencimiento: '2027-02-15' },
  ];

  /** Un renglón de un producto CON control de lote pero sin lote asignado. */
  const itemSinLote = (id: number) => ({
    id,
    cantidad: null,
    // La existencia del producto: es lo que se sabe mientras no haya lote.
    cantidadFisica: 42,
    presentacion: { id: 9, cantidad: 1, producto: { id: 200, descripcion: 'PILSEN', lote: true } },
    lote: null,
  });

  const itemConLote = (id: number, loteId: number, numeroLote: string) => ({
    id,
    cantidad: null,
    cantidadFisica: 24,
    presentacion: { id: 9, cantidad: 1, producto: { id: 200, descripcion: 'PILSEN', lote: true } },
    lote: {
      id: loteId,
      numeroLote,
      fechaVencimiento: '2026-12-01',
      fechaRetiro: '2026-11-01',
      estado: EstadoLote.LIBERADO,
    },
  });

  const inventario = (items: unknown[] = []) => ({
    id: 5,
    estado: InventarioEstado.ABIERTO,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      { id: 91, concluido: false, zona: { id: 11, descripcion: 'gondola 3' }, inventarioProductoItemList: items },
    ],
  });

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario())),
      guardarItem: vi.fn(() => of({ id: 500 })),
    };
    busqueda = { stock: vi.fn(() => of(42)) };
    productos = { vencimientosConocidos: vi.fn(() => of([])) };
    dialogo = { abrir: vi.fn(async () => SELECCION) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };
    lotes = {
      stockPorLote: vi.fn(() => of(STOCK_POR_LOTE)),
      buscar: vi.fn(() => of({ getContent: [] })),
      actualizarFechas: vi.fn(() => of({})),
      crear: vi.fn(() => of({ id: 77, numeroLote: 'L-NUEVO' })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: ProductoService, useValue: productos },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
        { provide: LoteService, useValue: lotes },
        {
          provide: AuthService,
          useValue: { usuario: signal({ id: 41 }), sucursal: signal({ id: 3 }), roles: signal([]) },
        },
      ],
    });
  });

  const montar = (items: unknown[] = []) => {
    servicio.porId = vi.fn(() => of(inventario(items)));
    const f = TestBed.createComponent(InventarioCargaPage);
    f.componentRef.setInput('id', '5');
    f.componentRef.setInput('productoId', '91');
    f.detectChanges();
    return f;
  };

  it('entra como un renglón solo, sin lote todavía', async () => {
    const f = montar();

    await f.componentInstance.agregarProducto();

    expect(servicio.guardarItem).toHaveBeenCalledTimes(1);
    expect(servicio.guardarItem.mock.calls[0][0].loteId).toBeUndefined();
    // El stock del producto, como cualquier otro: el saldo por lote todavía no
    // se puede saber porque no hay lote elegido.
    expect(servicio.guardarItem.mock.calls[0][0].cantidadFisica).toBe(42);
    expect(lotes.stockPorLote).not.toHaveBeenCalled();
  });

  it('el renglón sin lote no se puede contar', () => {
    const f = montar([itemSinLote(500)]);

    f.componentInstance.alternar(500);
    f.detectChanges();

    const input: HTMLInputElement | null = f.nativeElement.querySelector('input[type="number"]');
    expect(input?.disabled).toBe(true);
  });

  it('con el lote asignado el conteo se habilita', () => {
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);

    f.componentInstance.alternar(500);
    f.detectChanges();

    const input: HTMLInputElement | null = f.nativeElement.querySelector('input[type="number"]');
    expect(input?.disabled).toBe(false);
  });

  it('elegir un lote completa el renglón que ya está, no abre otro', async () => {
    const f = montar([itemSinLote(500)]);
    dialogo.abrir = vi.fn(async () => ({ loteId: 41, numeroLote: 'L-2026-88', saldo: 24 }));

    await f.componentInstance.agregarLote(f.componentInstance.items()[0]);

    const enviado = servicio.guardarItem.mock.calls[0][0];
    // Con el id del renglón: es el que el operador tiene abierto.
    expect(enviado.id).toBe(500);
    expect(enviado.loteId).toBe(41);
  });

  it('al asignar el lote, «Sistema» pasa a ser el saldo DE ESE LOTE', async () => {
    // El renglón traía 42 —la existencia del producto— y el lote tiene 24. Si
    // quedara en 42, el renglón mostraría un faltante que no existe.
    const f = montar([itemSinLote(500)]);
    dialogo.abrir = vi.fn(async () => ({ loteId: 41, numeroLote: 'L-2026-88', saldo: 24 }));

    await f.componentInstance.agregarLote(f.componentInstance.items()[0]);

    expect(servicio.guardarItem.mock.calls[0][0].cantidadFisica).toBe(24);
  });

  it('en un renglón que ya tiene lote, elegir otro abre un renglón nuevo', async () => {
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);
    dialogo.abrir = vi.fn(async () => ({ loteId: 42, numeroLote: 'L-2026-91', saldo: 13 }));

    await f.componentInstance.agregarLote(f.componentInstance.items()[0]);

    const enviado = servicio.guardarItem.mock.calls[0][0];
    // Sin id: es un renglón nuevo. Con el id pisaría el lote que ya se contó.
    expect(enviado.id).toBeUndefined();
    expect(enviado.loteId).toBe(42);
  });

  it('crear un lote lo da de alta y lo deja usado en el renglón', async () => {
    const f = montar([itemSinLote(500)]);
    dialogo.abrir = vi.fn(async () => ({
      numeroLote: 'L-NUEVO',
      fechaVencimiento: '2027-03-01',
      fechaRetiro: '',
    }));
    lotes.crear = vi.fn(() => of({ id: 77, numeroLote: 'L-NUEVO', fechaVencimiento: '2027-03-01' }));

    await f.componentInstance.crearLote(f.componentInstance.items()[0]);

    expect(lotes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ productoId: 200, numeroLote: 'L-NUEVO' }),
    );
    const enviado = servicio.guardarItem.mock.calls[0][0];
    expect(enviado.id).toBe(500);
    expect(enviado.loteId).toBe(77);
    // Lote recién creado: saldo cero. Todo lo que se cuente es diferencia, que
    // es exactamente lo que se está atribuyendo.
    expect(enviado.cantidadFisica).toBe(0);
  });

  it('un producto sin lote sigue contando como siempre', async () => {
    // Regresión cero: son los ~8.700 productos que no llevan lote.
    dialogo.abrir = vi.fn(async () => ({
      producto: { id: 300, descripcion: 'AZUCAR 1KG' },
      presentacion: { id: 7, cantidad: 1 },
    }));
    const f = montar();

    await f.componentInstance.agregarProducto();

    expect(busqueda.stock).toHaveBeenCalled();
    expect(servicio.guardarItem.mock.calls[0][0].loteId).toBeUndefined();
  });

  it('la fecha de retiro va al maestro del lote, no al renglón', () => {
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);

    f.componentInstance.cambiarFechaRetiro(500, '2026-10-20');
    f.componentInstance.guardar();

    expect(lotes.actualizarFechas).toHaveBeenCalledWith(
      expect.objectContaining({ loteId: 41, fechaRetiro: '2026-10-20' }),
    );
  });

  it('corregir solo la fecha del lote alcanza para guardar, sin contar nada', () => {
    // Antes «Guardar conteo» exigía una cantidad: con lote, corregir la fecha
    // de retiro es un cambio legítimo por sí solo.
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);

    f.componentInstance.cambiarFechaRetiro(500, '2026-10-20');
    f.componentInstance.guardar();

    expect(notificacion.warn).not.toHaveBeenCalled();
    expect(lotes.actualizarFechas).toHaveBeenCalled();
  });

  it('con lote no se sugiere ningún vencimiento «anterior»', () => {
    // El maestro YA tiene la fecha: ofrecer al lado otra sacada de una compra
    // vieja sería contradecir en la misma pantalla el dato que se edita.
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-07-14', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);

    expect(f.componentInstance.items()[0].conocido).toBeNull();
  });

  it('el vencimiento que se muestra sale del lote, no de la copia del renglón', () => {
    const f = montar([itemConLote(500, 41, 'L-2026-88')]);

    expect(f.componentInstance.items()[0].vencimiento).toBe('2026-12-01');
    expect(f.componentInstance.items()[0].fechaRetiro).toBe('2026-11-01');
  });
});
