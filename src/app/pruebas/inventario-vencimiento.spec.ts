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
  let productos: { vencimientosConocidos: ReturnType<typeof vi.fn> };

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
    productos = { vencimientosConocidos: vi.fn(() => of([])) };

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

  /*
   * ⚠️ El doble expone `vencimientosConocidos` y NO `vencidos`: si la pantalla
   * volviera al reporte de productos vencidos, estos tests explotarían. Es a
   * propósito. Ese reporte ancla sus cinco fuentes al último inventario de la
   * sucursal, y la toma que se está contando ES el último inventario, así que
   * mientras se cuenta devuelve cero. En bodega3, COCA COLA 500ML tiene 81
   * fechas conocidas de su caja x 6 y no devolvía ninguna, diera igual la
   * fuente.
   */
  it('pide los vencimientos de toda la zona en una sola consulta', () => {
    servicio.porId = vi.fn(() => of(inventario([item(1, 9), item(2, 8)])));
    montar();

    expect(productos.vencimientosConocidos).toHaveBeenCalledTimes(1);
    const [sucursalId, productoIds, opciones] = productos.vencimientosConocidos.mock.calls[0];
    expect(sucursalId).toBe(3);
    expect(productoIds).toEqual([200]);
    // Secundaria: no aporta a la barra de carga ni tira un toast.
    expect(opciones).toEqual({ mostrarCarga: false, notificarError: false });
  });

  it('NO prellena el campo: ofrece el más próximo a vencer, no lo impone', () => {
    // ⚠️ Una fecha puesta por el sistema se lee como una fecha cargada por
    // una persona, y si encima ya venció el renglón aparece en rojo sin que
    // nadie haya mirado el envase. Lo conocido se ofrece abajo, con un botón.
    productos.vencimientosConocidos = vi.fn(() =>
      of([
        { presentacionId: 9, vencimiento: '2027-05-10', fuenteVerdad: 'COMPRA', detalleFuente: 'Nota #7' },
        { presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'INVENTARIO' },
      ]),
    );
    const f = montar();

    expect(f.componentInstance.items()[0].vencimiento).toBe('');
    // El más próximo a vencer que todavía no venció es el que se ofrece.
    expect(f.componentInstance.items()[0].conocido?.fecha).toBe('2026-11-20');
  });

  it('dice de dónde salió la fecha que ofrece', () => {
    productos.vencimientosConocidos = vi.fn(() =>
      of([
        { presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA', detalleFuente: 'Nota de compra #123' },
      ]),
    );
    const f = montar();
    // La zona arranca colapsada: el origen se lee al desplegar el ítem.
    f.componentInstance.alternar(1);
    f.detectChanges();

    // Sin el origen, una fecha suelta no deja decidir si creerle.
    expect(f.nativeElement.textContent).toContain('Nota de compra #123');
    expect(f.nativeElement.textContent).toContain('Anterior 20/11/2026');
  });

  it('no pisa un vencimiento ya cargado en el ítem', () => {
    // Lo que alguien escribió mirando el envase gana sobre cualquier dato de
    // sistema.
    servicio.porId = vi.fn(() => of(inventario([item(1, 9, '2026-01-15')])));
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar();

    expect(f.componentInstance.items()[0].vencimiento).toBe('2026-01-15');
  });

  it('muestra el vencimiento anterior aunque el ítem ya tenga fecha propia', () => {
    // Es el caso donde más sirve y era el único donde se escondía: con una
    // fecha ya cargada, quien cuenta no tenía contra qué comparar el envase.
    servicio.porId = vi.fn(() => of(inventario([item(1, 9, '2026-01-15')])));
    productos.vencimientosConocidos = vi.fn(() =>
      of([
        {
          presentacionId: 9,
          vencimiento: '2026-11-20',
          fuenteVerdad: 'COMPRA',
          detalleFuente: 'Nota de compra #123',
        },
      ]),
    );
    const f = montar();
    f.componentInstance.alternar(1);
    f.detectChanges();

    expect(f.componentInstance.items()[0].conocido?.fecha).toBe('2026-11-20');
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Anterior 20/11/2026');
    expect(texto).toContain('Nota de compra #123');
  });

  it('«usar» aparece solo mientras el campo no tenga esa fecha', () => {
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar();
    f.componentInstance.alternar(1);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.usar').length).toBe(1);

    f.componentInstance.cambiarVencimiento(1, '2026-11-20');
    f.detectChanges();

    expect(f.componentInstance.items()[0].vencimiento).toBe('2026-11-20');
    // Adoptado, el botón no tiene nada que ofrecer; la línea queda como
    // constancia de de dónde salió la fecha.
    expect(f.nativeElement.querySelectorAll('.usar').length).toBe(0);
    expect(f.nativeElement.textContent).toContain('Anterior 20/11/2026');
  });

  it('borrar la fecha la deja borrada, y lo conocido se vuelve a ofrecer', () => {
    servicio.porId = vi.fn(() => of(inventario([item(1, 9, '2026-01-15')])));
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar();

    f.componentInstance.cambiarVencimiento(1, '');

    // Borrar es una decisión: no se vuelve a prellenar solo.
    expect(f.componentInstance.items()[0].vencimiento).toBe('');
    expect(f.componentInstance.items()[0].conocido?.fecha).toBe('2026-11-20');
  });

  it('sin tocar el vencimiento, no se guarda ninguna fecha', () => {
    // ⚠️ Antes se guardaba la sugerida sin que nadie la hubiera mirado, así
    // que el conteo afirmaba un vencimiento que el operador nunca confirmó.
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar();

    f.componentInstance.cambiarContado(1, { target: { value: '23' } } as unknown as Event);
    f.componentInstance.guardar();

    expect(servicio.guardarItem.mock.calls[0][0].vencimiento).toBeUndefined();
  });

  it('la fecha adoptada con «usar» sí se guarda', () => {
    productos.vencimientosConocidos = vi.fn(() =>
      of([{ presentacionId: 9, vencimiento: '2026-11-20', fuenteVerdad: 'COMPRA' }]),
    );
    const f = montar();

    f.componentInstance.cambiarVencimiento(1, '2026-11-20');
    f.componentInstance.cambiarContado(1, { target: { value: '23' } } as unknown as Event);
    f.componentInstance.guardar();

    expect(servicio.guardarItem.mock.calls[0][0].vencimiento).toBe('2026-11-20');
  });

  it('si la consulta falla lo dice, en vez de dejar los campos vacíos y callar', () => {
    // Un campo vacío afirmaría «no hay vencimiento conocido», que es una
    // respuesta distinta de «no pude preguntar».
    productos.vencimientosConocidos = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    f.detectChanges();

    expect(f.componentInstance.sugerenciasFallaron()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No se pudieron traer los vencimientos');
  });

  it('sin vencimientos conocidos no ofrece nada', () => {
    const f = montar();
    expect(f.componentInstance.items()[0].vencimiento).toBe('');
    expect(f.componentInstance.items()[0].conocido).toBeNull();
  });
});
