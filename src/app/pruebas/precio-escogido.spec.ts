import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { ConversionPrecioService } from 'src/app/domains/moneda/conversion-precio.service';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { PrecioMonedaService } from 'src/app/domains/moneda/precio-moneda.service';
import type { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { ProductoBusquedaService, sinImagenes } from 'src/app/domains/productos/producto-busqueda.service';
import { KioscoConfigService } from 'src/app/pages/producto/kiosco-config.service';
import { KioscoPage } from 'src/app/pages/producto/kiosco.page';
import { precioDe, precioEscogido } from 'src/app/shared/producto/presentacion.util';

/**
 * #142: `precioPrincipal` del central llega con el id de la presentación
 * (central #605). El precio escogido sale de `precios` (ids reales), con el
 * mismo importe que eligió el central.
 */
describe('Precio escogido de una presentación (#142)', () => {
  const pres = (p: Partial<Presentacion>) => ({ id: 5, ...p }) as unknown as Presentacion;

  it('BANES FORTE: el principal de la lista (id 10), no el del central (id 5 = la presentación)', () => {
    const p = pres({
      precioPrincipal: { id: 5, precio: 4.55 } as never,
      precios: [
        { id: 10, precio: 4.55, principal: true, activo: true },
        { id: 11, precio: 11000, principal: false, activo: true },
      ] as never,
    });

    expect(precioEscogido(p)?.id).toBe(10);
    expect(precioDe(p)).toBe(4.55);
  });

  it('con dos principales de importes distintos, el del importe que eligió el central, no el primero', () => {
    const p = pres({
      precioPrincipal: { id: 5, precio: 20000 } as never,
      precios: [
        { id: 30, precio: 18000, principal: true, activo: true },
        { id: 31, precio: 20000, principal: true, activo: true },
      ] as never,
    });

    expect(precioEscogido(p)?.id).toBe(31);
    expect(precioDe(p)).toBe(20000);
  });

  it('si ningún principal de la lista tiene ese importe, el del central como siempre', () => {
    const p = pres({
      precioPrincipal: { id: 5, precio: 5000 } as never,
      precios: [{ id: 40, precio: 9000, principal: false, activo: true }] as never,
    });

    expect(precioEscogido(p)?.id).toBe(5);
    expect(precioDe(p)).toBe(5000);
  });

  it('sin precio del central: el principal de la lista con importe (salta uno sin importe)', () => {
    const p = pres({
      precios: [
        { id: 50, precio: null, principal: true, activo: true },
        { id: 51, precio: 7000, principal: true, activo: true },
      ] as never,
    });

    expect(precioEscogido(p)?.id).toBe(51);
  });

  it('sin principal en ningún lado: el primer activo con importe, como siempre', () => {
    const p = pres({
      precios: [
        { id: 60, precio: 9000, principal: false, activo: false },
        { id: 61, precio: 7000, principal: false, activo: true },
      ] as never,
    });

    expect(precioDe(p)).toBe(7000);
  });

  it('el kiosco pide la moneda del precio real: un precio en dólares no pasa por guaraníes', () => {
    const usd = Object.assign(new Moneda(), { id: 3, simbolo: 'US$', decimales: 2 });
    const monedaDe = vi.fn((id: unknown) => (String(id) === '10' ? usd : null));
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ProductoBusquedaService,
          useValue: { porEscaneo: vi.fn(), imagenesDePresentaciones: vi.fn(() => of(sinImagenes())) },
        },
        { provide: EscanerService, useValue: {} },
        { provide: ConversionPrecioService, useValue: { convertir: vi.fn(() => of([])) } },
        { provide: PrecioMonedaService, useValue: { listo: vi.fn(async () => undefined), monedaDe } },
        { provide: KioscoConfigService, useValue: { modo: signal('lector') } },
        { provide: DialogoService, useValue: {} },
      ],
    });
    const c = TestBed.createComponent(KioscoPage).componentInstance as unknown as {
      monedaPropiaDe(p: Presentacion): Moneda | null;
    };
    const p = pres({
      precioPrincipal: { id: 5, precio: 4.55 } as never,
      precios: [{ id: 10, precio: 4.55, principal: true, activo: true }] as never,
    });

    expect(c.monedaPropiaDe(p)?.id).toBe(3);
    expect(monedaDe).toHaveBeenCalledWith(10);
  });
});
