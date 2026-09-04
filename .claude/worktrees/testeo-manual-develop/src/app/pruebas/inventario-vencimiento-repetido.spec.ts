import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { InventarioCargaPage } from '../pages/inventario/inventario-carga.page';
import { InventarioService } from '../pages/inventario/inventario.service';
import { LoteService } from '../domains/lote/lote.service';
import { ProductoService } from '../pages/producto/producto.service';

/**
 * Dos renglones de la misma presentación son **dos lotes**, y dos lotes no
 * pueden tener la misma fecha.
 *
 * ⚠️ **Lo conocido se pedía por presentación y nada más**, así que todos los
 * renglones de una presentación recibían la misma fecha. Tocar «usar» en los
 * dos dejaba dos renglones idénticos, que el central rechaza — y cuando la
 * fecha además se prellenaba, el operador lo veía como «le puse la fecha a uno
 * y me la puso en los dos».
 *
 * El campo ya no se prellena, así que lo que se reparte es **lo que se
 * ofrece**: cada renglón propone un lote distinto.
 */
describe('Vencimiento repetido entre renglones de la misma presentación', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; guardarItem: ReturnType<typeof vi.fn> };
  let productos: { vencimientosConocidos: ReturnType<typeof vi.fn> };

  const item = (id: number, vencimiento?: string) => ({
    id,
    cantidadFisica: 70,
    vencimiento,
    presentacion: { id: 9, cantidad: 1, producto: { id: 200, descripcion: 'COCA COLA 2L' } },
  });

  const inventario = (items: unknown[]) => ({
    id: 5,
    estado: InventarioEstado.ABIERTO,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      { id: 91, zona: { id: 11, descripcion: 'gondola 1' }, inventarioProductoItemList: items },
    ],
  });

  const conocidos = (...fechas: string[]) =>
    fechas.map((vencimiento) => ({
      presentacionId: 9,
      vencimiento,
      fuenteVerdad: 'COMPRA',
      detalleFuente: `Nota ${vencimiento}`,
    }));

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario([item(1), item(2)]))),
      guardarItem: vi.fn(() => of({ id: 1 })),
    };
    productos = { vencimientosConocidos: vi.fn(() => of(conocidos('2026-11-20', '2027-01-05'))) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La página lo inyecta siempre, pero solo lo usa con productos que
        // llevan control de lote: en estos casos ninguno lo lleva.
        {
          provide: LoteService,
          useValue: {
            stockPorLote: vi.fn(() => of([])),
            buscar: vi.fn(() => of({ getContent: [] })),
            actualizarFechas: vi.fn(() => of({})),
          },
        },
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

  it('dos renglones sin fecha se ofrecen lotes distintos, no el mismo dos veces', () => {
    const f = montar();
    const [uno, dos] = f.componentInstance.items();

    // Los dos campos arrancan vacíos: nada se prellena.
    expect(uno.vencimiento).toBe('');
    expect(dos.vencimiento).toBe('');

    expect(uno.conocido?.fecha).toBe('2026-11-20');
    // El segundo renglón es otro lote: ofrecerle la misma fecha lo convierte
    // en el mismo renglón dos veces, y el central lo rechaza al guardar.
    expect(dos.conocido?.fecha).toBe('2027-01-05');
  });

  it('no ofrece una fecha que otro renglón ya tiene cargada', () => {
    // Es el caso que reportó el operador: uno ya tenía fecha y al otro se le
    // ofrecía la misma, así que adoptarla dejaba los dos iguales.
    servicio.porId = vi.fn(() => of(inventario([item(1, '2026-11-20'), item(2)])));
    const f = montar();
    const [uno, dos] = f.componentInstance.items();

    expect(uno.vencimiento).toBe('2026-11-20');
    expect(dos.conocido?.fecha).not.toBe('2026-11-20');
    expect(dos.conocido?.fecha).toBe('2027-01-05');
  });

  it('sin otro lote conocido, al segundo renglón no se le ofrece nada', () => {
    // Ofrecer la única fecha conocida a los dos sería proponer que ese lote
    // está dos veces. Sin nada que ofrecer, hay que mirar el envase — que es
    // lo correcto.
    productos.vencimientosConocidos = vi.fn(() => of(conocidos('2026-11-20')));
    const f = montar();
    const [uno, dos] = f.componentInstance.items();

    expect(uno.conocido?.fecha).toBe('2026-11-20');
    expect(dos.conocido).toBeNull();
  });

  it('adoptar el lote ofrecido en los dos renglones no manda la misma fecha', () => {
    const f = montar();
    const [uno, dos] = f.componentInstance.items();

    // El operador toca «usar» en los dos, que es el camino natural.
    f.componentInstance.cambiarVencimiento(1, uno.conocido!.fecha);
    f.componentInstance.cambiarVencimiento(2, dos.conocido!.fecha);
    f.componentInstance.cambiarContado(1, { target: { value: '10' } } as unknown as Event);
    f.componentInstance.cambiarContado(2, { target: { value: '4' } } as unknown as Event);
    f.componentInstance.guardar();

    const fechas = servicio.guardarItem.mock.calls.map((c) => c[0].vencimiento);
    expect(new Set(fechas).size).toBe(fechas.length);
  });

  it('escribir a mano una fecha en un renglón no toca la del otro', () => {
    servicio.porId = vi.fn(() => of(inventario([item(1, '2026-11-20'), item(2, '2027-01-05')])));
    const f = montar();

    f.componentInstance.cambiarVencimiento(2, '2027-03-15');
    const [uno, dos] = f.componentInstance.items();

    expect(uno.vencimiento).toBe('2026-11-20');
    expect(dos.vencimiento).toBe('2027-03-15');
  });

  it('una presentación distinta no compite por los lotes de la otra', () => {
    servicio.porId = vi.fn(() =>
      of(
        inventario([
          item(1),
          { id: 3, cantidadFisica: 5, presentacion: { id: 8, cantidad: 12, producto: { id: 200 } } },
        ]),
      ),
    );
    productos.vencimientosConocidos = vi.fn(() =>
      of([
          { presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' },
          { presentacionId: 8, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' },
        ]),
    );
    const f = montar();
    const [uno, dos] = f.componentInstance.items();

    // Misma fecha, pero son presentaciones distintas: no es el mismo renglón.
    expect(uno.conocido?.fecha).toBe('2026-11-20');
    expect(dos.conocido?.fecha).toBe('2026-11-20');
  });
});
