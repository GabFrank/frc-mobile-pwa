import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import type { Inventario } from '../domains/inventario/inventario.model';
import type { Usuario } from '../domains/personas/usuario.model';
import { InventarioNuevoPage } from '../pages/inventario/inventario-nuevo.page';
import { InventarioService } from '../pages/inventario/inventario.service';

/**
 * Abrir una toma de inventario.
 *
 * Lo que estos casos protegen es la regla que `frc-mobile` tiene escrita y
 * nunca ejecuta: **una sola toma abierta por sucursal**. Allá el chequeo vive
 * en un método que solo llama el escáner, dentro de un bloque oculto, así que
 * el botón «Nuevo inventario» abre una segunda toma sin preguntar nada.
 */
describe('Nuevo inventario', () => {
  let sucursales: { todas: ReturnType<typeof vi.fn> };
  let inventario: {
    abiertosDe: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
    cancelar: ReturnType<typeof vi.fn>;
    finalizar: ReturnType<typeof vi.fn>;
  };
  let dialogo: { confirmar: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  /**
   * Como viene de la base real: SERVIDOR y COMPRAS están activas pero **sin
   * depósito**, así que no mueven stock y no se inventarían. Lo discrimina
   * `deposito`, no el nombre.
   */
  const TODAS = [
    { id: 0, nombre: 'SERVIDOR', deposito: false, activo: true },
    { id: 999, nombre: 'COMPRAS', deposito: false, activo: true },
    { id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true },
    { id: 3, nombre: 'SUC. ROTONDA', deposito: true, activo: true },
  ];

  /**
   * Como está la base real: tres tomas abiertas en la misma sucursal, dos de
   * 2023 y de otra persona. Los ids van distintos entre sí a propósito.
   */
  const ABIERTAS: Inventario[] = [
    { id: 1041, estado: InventarioEstado.ABIERTO, fechaInicio: '2023-05-25 14:03', usuario: { persona: { nombre: 'MARCOS' } } as Usuario },
    { id: 2076, estado: InventarioEstado.ABIERTO, fechaInicio: '2023-09-22 08:24', usuario: { persona: { nombre: 'MARCOS' } } as Usuario },
    { id: 7533, estado: InventarioEstado.ABIERTO, fechaInicio: '2026-06-12 14:58', usuario: { persona: { nombre: 'DIEGO' } } as Usuario },
  ];

  beforeEach(() => {
    sucursales = { todas: vi.fn(() => of(TODAS)) };
    inventario = {
      abiertosDe: vi.fn(() => of([])),
      crear: vi.fn(() => of({ id: 77 })),
      cancelar: vi.fn(() => of(true)),
      finalizar: vi.fn(() => of({ id: 1 })),
    };
    dialogo = { confirmar: vi.fn(async () => true) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        // Con `provideRouter([])` la navegación posterior al alta queda como
        // rechazo sin manejar y ensucia la corrida.
        provideRouter([{ path: 'inventario/:id', children: [] }]),
        { provide: SucursalService, useValue: sucursales },
        { provide: InventarioService, useValue: inventario },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: 41, nickname: 'diego', persona: { nombre: 'DIEGO' } }),
            sucursal: signal({ id: 3, nombre: 'SUC. ROTONDA', deposito: true, activo: true }),
            roles: signal(['CREAR INVENTARIO']),
          },
        },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(InventarioNuevoPage);
    f.detectChanges();
    return f;
  };

  it('solo ofrece sucursales que pueden mover stock', () => {
    const f = montar();
    // SERVIDOR y COMPRAS quedan afuera: sin depósito no hay nada que contar.
    expect(f.componentInstance.opcionesSucursal().map((o) => o.valor)).toEqual([1, 3]);
  });

  it('arranca en la sucursal de la sesión', () => {
    const f = montar();
    expect(f.componentInstance.sucursalId()).toBe(3);
    expect(inventario.abiertosDe).toHaveBeenCalledWith(3);
  });

  /**
   * ⚠️ **Con tomas abiertas, avisa y deja seguir.** Bloquear parecía lo
   * correcto hasta ver los datos reales: `SUC. CENTRAL` tiene **24**
   * inventarios en estado `ABIERTO`, el más viejo de mayo de 2023 y casi
   * todos vacíos. Cerrás uno y aparece el siguiente — el alta quedaba
   * inutilizable, y la única salida que ofrecíamos era *finalizar*, que
   * ajusta el stock de hoy con un conteo de hace tres años.
   */
  it('lista todas las tomas abiertas, no solo la primera', async () => {
    inventario.abiertosDe = vi.fn(() => of(ABIERTAS));
    const f = montar();
    await f.whenStable();
    f.detectChanges();

    expect(f.componentInstance.abiertas().length).toBe(3);
    // Que sean 3 es el dato que cambia la decisión: ver una sola hace pensar
    // «la cierro y sigo».
    expect(texto(f)).toContain('Tomas abiertas en esta sucursal (3)');
    expect(texto(f)).toContain('#1041');
    expect(texto(f)).toContain('#7533');
  });

  it('con tomas abiertas igual deja iniciar', async () => {
    inventario.abiertosDe = vi.fn(() => of(ABIERTAS));
    const f = montar();
    await f.whenStable();
    f.detectChanges();

    expect(texto(f)).toContain('Iniciar inventario');
  });

  it('la confirmación nombra las tomas abiertas', async () => {
    inventario.abiertosDe = vi.fn(() => of(ABIERTAS));
    const f = montar();
    await f.whenStable();
    await f.componentInstance.crear();

    const mensaje = dialogo.confirmar.mock.calls[0][0].mensaje as string;
    // Sin esto, alguien abre la vigésimo quinta toma sin enterarse.
    expect(mensaje).toContain('3');
  });

  it('ofrece cancelar una toma abierta, que es el remedio que no tocaba el stock', async () => {
    inventario.abiertosDe = vi.fn(() => of(ABIERTAS));
    const f = montar();
    await f.whenStable();
    f.detectChanges();

    await f.componentInstance.cancelar(ABIERTAS[0], new Event('click'));

    expect(inventario.cancelar).toHaveBeenCalledWith(1041);
    // Cancelar no toca el stock; finalizar sí. Para una toma que nadie va a
    // terminar, ofrecer solo finalizar era empujar al descuadre.
    expect(inventario.finalizar).not.toHaveBeenCalled();
  });

  it('cancelar la confirmación no cancela la toma', async () => {
    dialogo.confirmar = vi.fn(async () => false);
    inventario.abiertosDe = vi.fn(() => of(ABIERTAS));
    const f = montar();
    await f.whenStable();
    await f.componentInstance.cancelar(ABIERTAS[0], new Event('click'));

    expect(inventario.cancelar).not.toHaveBeenCalled();
  });

  it('sin ninguna abierta, ofrece iniciar sin avisos', async () => {
    const f = montar();
    await f.whenStable();
    f.detectChanges();
    expect(texto(f)).toContain('Iniciar inventario');
    expect(texto(f)).not.toContain('Tomas abiertas');
  });

  it('si no se puede consultar, avisa pero no afirma que está limpia', async () => {
    // «No hay ninguna» y «no pude preguntar» son respuestas distintas.
    inventario.abiertosDe = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    await f.whenStable();
    f.detectChanges();

    expect(notificacion.warn).toHaveBeenCalled();
    expect(f.componentInstance.abiertas()).toEqual([]);
  });

  it('crea la toma abierta, por zona y a nombre de quien la abre', async () => {
    const f = montar();
    await f.componentInstance.crear();

    expect(inventario.crear).toHaveBeenCalledWith({
      sucursalId: 3,
      usuarioId: 41,
      abierto: true,
      estado: InventarioEstado.ABIERTO,
      tipo: 'ZONA',
    });
  });

  /**
   * Regresión de `frc-mobile`: su confirmación es
   * `if (res.role = 'aceptar')` —una asignación, no una comparación—, así que
   * cancelar abre el inventario igual.
   */
  it('cancelar la confirmación no crea nada', async () => {
    dialogo.confirmar = vi.fn(async () => false);
    const f = montar();
    await f.componentInstance.crear();

    expect(inventario.crear).not.toHaveBeenCalled();
  });
});
