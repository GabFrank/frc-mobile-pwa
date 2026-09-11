import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransferenciaItem } from '../domains/transferencia/transferencia.model';
import { TransferenciaDetallePage } from '../pages/transferencias/transferencia-detalle.page';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';

/**
 * La trazabilidad por etapas es la razón de ser del módulo: permite saber
 * **en qué punto** de la cadena apareció una diferencia. Estos casos fijan
 * que no se colapse ni se invente información.
 */
describe('Etapas de un ítem de transferencia', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; items: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of({ id: 1, isOrigen: true, isDestino: false })),
      items: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TransferenciaService, useValue: servicio }],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '1');
    f.detectChanges();
    return f;
  };

  it('conserva las cuatro cifras, no solo la última', () => {
    // 10 pedidos → 8 preparados → 8 despachados → 7 recibidos.
    // La diferencia 10→8 es falta de stock en origen; la 8→7, un faltante en
    // tránsito. Con una sola cifra los dos casos son indistinguibles.
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 10,
      cantidadPreparacion: 8,
      cantidadTransporte: 8,
      cantidadRecepcion: 7,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos.map((p) => p.cantidad)).toEqual([10, 8, 8, 7]);
    expect(pasos.map((p) => p.etiqueta)).toEqual([
      'Pedido',
      'Preparado',
      'Despachado',
      'Recibido',
    ]);
  });

  it('una etapa que todavía no pasó no se muestra en cero', () => {
    // «Sin cantidad» significa «no llegó ahí», no «cero unidades».
    const item: TransferenciaItem = { id: 1, cantidadPreTransferencia: 10, cantidadPreparacion: 8 };
    const f = montar();

    expect(f.componentInstance.pasosDe(item).map((p) => p.etiqueta)).toEqual([
      'Pedido',
      'Preparado',
    ]);
  });

  it('lleva la presentación de cada etapa', () => {
    // Se pide en cajas y se despacha en unidades: comparar cantidades sin
    // mirar la presentación da diferencias falsas.
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 2,
      presentacionPreTransferencia: { id: 1, cantidad: 12 } as never,
      cantidadTransporte: 24,
      presentacionTransporte: { id: 2, cantidad: 1 } as never,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos[0].porBulto).toBe(12);
    expect(pasos[1].porBulto).toBe(1);
  });

  it('muestra el motivo de rechazo de la etapa que lo registró', () => {
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 10,
      cantidadPreparacion: 0,
      motivoRechazoPreparacion: 'FALTA_PRODUCTO' as never,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos[1].rechazo).toBe('FALTA_PRODUCTO');
  });

  it('un ítem sin ninguna etapa no inventa filas', () => {
    const f = montar();
    expect(f.componentInstance.pasosDe({ id: 1 })).toEqual([]);
  });
});

describe('De qué lado está el usuario', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; items: ReturnType<typeof vi.fn> };

  const montarCon = (isOrigen: boolean, isDestino: boolean) => {
    servicio = {
      porId: vi.fn(() => of({ id: 1, isOrigen, isDestino })),
      items: vi.fn(() => of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TransferenciaService, useValue: servicio }],
    });
    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '1');
    f.detectChanges();
    return f;
  };

  it('en origen se prepara y despacha', () => {
    // Los flags los resuelve el backend: no se infiere comparando ids.
    expect(montarCon(true, false).componentInstance.rol()).toContain('Origen');
  });

  it('en destino se recibe y verifica', () => {
    expect(montarCon(false, true).componentInstance.rol()).toContain('Destino');
  });

  it('la misma sucursal en los dos extremos es un caso válido', () => {
    expect(montarCon(true, true).componentInstance.rol()).toBe('Origen y destino');
  });

  it('sin ninguno de los dos, es consulta', () => {
    expect(montarCon(false, false).componentInstance.rol()).toBe('Solo consulta');
  });
});
