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
 * El vencimiento que la pantalla propone al contar.
 *
 * Sale de `productosVencidos`, que en el central unifica inventario, compra y
 * transferencia. `frc-mobile` no tiene nada de esto: su único camino mira
 * **solo inventarios** y exige abrir un acordeón y copiar a mano.
 */
describe('Vencimiento sugerido al contar', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; guardarItem: ReturnType<typeof vi.fn> };
  let productos: { vencidos: ReturnType<typeof vi.fn> };

  const item = (id: number, presentacionId: number, vencimiento?: string) => ({
    id,
    cantidadFisica: 70,
    vencimiento,
    presentacion: { id: presentacionId, cantidad: 1, producto: { id: 200, descripcion: 'COCA COLA 2L' } },
  });

  const inventario = (items: unknown[]) => ({
    id: 5,
    estado: InventarioEstado.ABIERTO,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      { id: 91, zona: { id: 11, descripcion: 'gondola 1' }, inventarioProductoItemList: items },
    ],
  });

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario([item(1, 9)]))),
      guardarItem: vi.fn(() => of({ id: 1 })),
    };
    productos = { vencidos: vi.fn(() => of({ getContent: [] })) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: ProductoService, useValue: productos },
        { provide: ProductoBusquedaService, useValue: { stock: vi.fn(() => of(0)) } },
        { provide: DialogoService, useValue: { abrir: vi.fn() } },
        { provide: NotificacionService, useValue: { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() } },
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

  it('pide todos los vencimientos de la zona en una sola consulta', () => {
    servicio.porId = vi.fn(() => of(inventario([item(1, 9), item(2, 8)])));
    montar();

    expect(productos.vencidos).toHaveBeenCalledTimes(1);
    const [filtros, opciones] = productos.vencidos.mock.calls[0];
    expect(filtros.sucursalIds).toEqual([3]);
    // Sin filtro de fechas y sin `soloVencidos`: si no, el central devuelve
    // solo lo caduco y la mayoría de los campos quedarían vacíos.
    expect(filtros.soloVencidos).toBe(false);
    expect(filtros.desde).toBeUndefined();
    // Secundaria: no aporta a la barra de carga ni tira un toast.
    expect(opciones).toEqual({ mostrarCarga: false, notificarError: false });
  });

  it('prellena el campo con el más próximo a vencer', () => {
    productos.vencidos = vi.fn(() =>
      of({
        getContent: [
          { presentacionId: 9, vencimiento: '2027-05-10', fuenteVerdad: 'COMPRA', detalleFuente: 'Nota #7' },
          { presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'INVENTARIO' },
        ],
      }),
    );
    const f = montar();

    expect(f.componentInstance.items()[0].vencimiento).toBe('2026-11-20');
  });

  it('dice de dónde salió la fecha', () => {
    productos.vencidos = vi.fn(() =>
      of({
        getContent: [
          { presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA', detalleFuente: 'Nota de compra #123' },
        ],
      }),
    );
    const f = montar();
    f.detectChanges();

    // Sin el origen, «sugerido» a secas no deja decidir si creerle.
    expect(f.nativeElement.textContent).toContain('Nota de compra #123');
  });

  it('no pisa un vencimiento ya cargado en el ítem', () => {
    // Lo que alguien escribió mirando el envase gana sobre cualquier
    // sugerencia: la sugerencia es un dato de sistema, no una corrección.
    servicio.porId = vi.fn(() => of(inventario([item(1, 9, '2026-01-15')])));
    productos.vencidos = vi.fn(() =>
      of({ getContent: [{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }] }),
    );
    const f = montar();

    expect(f.componentInstance.items()[0].vencimiento).toBe('2026-01-15');
    expect(f.componentInstance.items()[0].sugerencia).toBeNull();
  });

  it('la sugerencia se guarda junto con el conteo', () => {
    productos.vencidos = vi.fn(() =>
      of({ getContent: [{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }] }),
    );
    const f = montar();

    f.componentInstance.cambiarContado(1, { target: { value: '23' } } as unknown as Event);
    f.componentInstance.guardar();

    expect(servicio.guardarItem.mock.calls[0][0].vencimiento).toBe('2026-11-20');
  });

  it('si la consulta falla lo dice, en vez de dejar los campos vacíos y callar', () => {
    // Un campo vacío afirmaría «no hay vencimiento conocido», que es una
    // respuesta distinta de «no pude preguntar».
    productos.vencidos = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    f.detectChanges();

    expect(f.componentInstance.sugerenciasFallaron()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No se pudieron traer los vencimientos');
  });

  it('sin vencimientos conocidos no inventa nada', () => {
    const f = montar();
    expect(f.componentInstance.items()[0].vencimiento).toBe('');
    expect(f.componentInstance.items()[0].sugerencia).toBeNull();
  });
});
