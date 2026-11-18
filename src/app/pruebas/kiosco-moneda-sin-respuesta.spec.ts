import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { ConversionPrecioService } from 'src/app/domains/moneda/conversion-precio.service';
import { PrecioMonedaService } from 'src/app/domains/moneda/precio-moneda.service';
import { ProductoBusquedaService, sinImagenes } from 'src/app/domains/productos/producto-busqueda.service';
import { KioscoConfigService } from 'src/app/pages/producto/kiosco-config.service';
import { KioscoPage } from 'src/app/pages/producto/kiosco.page';

/**
 * #139: si la lista de precios en otra moneda quedó sin respuesta, el kiosco la
 * vuelve a pedir antes de mostrar un precio; si sigue sin saberse, no muestra
 * un importe en una moneda que nadie confirmó (ante un cliente).
 */
describe('Kiosco con la lista de monedas sin respuesta (#139)', () => {
  const producto = { id: 5, descripcion: 'BANES FORTE', presentaciones: [] };

  const montar = (alReintentar: (sesion: MonedasSesion) => void) => {
    const listo = vi.fn(async () => alReintentar(TestBed.inject(MonedasSesion)));
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ProductoBusquedaService,
          useValue: { porEscaneo: vi.fn(() => of(producto)), imagenesDePresentaciones: vi.fn(() => of(sinImagenes())) },
        },
        { provide: EscanerService, useValue: {} },
        { provide: ConversionPrecioService, useValue: { convertir: vi.fn(() => of([])) } },
        { provide: PrecioMonedaService, useValue: { listo, monedaDe: () => null } },
        { provide: KioscoConfigService, useValue: { modo: signal('lector') } },
        { provide: DialogoService, useValue: {} },
      ],
    });
    const sesion = TestBed.inject(MonedasSesion);
    // La lista ya se resolvió, pero sin respuesta: `listos` queda en true al fallar.
    sesion.preciosMonedaListos.set(true);
    sesion.preciosMonedaSinRespuesta.set(true);
    // Sin detectChanges: no se arma la vista (cámara, conversión), solo el flujo del escaneo.
    const c = TestBed.createComponent(KioscoPage).componentInstance;
    return { c, listo };
  };

  const escanear = async (c: KioscoPage) => {
    c.texto.set('7840653007697');
    c.buscar();
    await Promise.resolve();
    await Promise.resolve();
  };

  it('reintenta la lista antes de mostrar y, si responde, muestra el producto', async () => {
    const { c, listo } = montar((s) => s.preciosMonedaSinRespuesta.set(false));

    await escanear(c);

    expect(listo).toHaveBeenCalledTimes(1);
    expect(c.producto()?.id).toBe(5);
    expect(c.error()).toBeNull();
  });

  it('si sigue sin respuesta, avisa y no muestra ningún importe', async () => {
    const { c } = montar(() => undefined);

    await escanear(c);

    expect(c.producto()).toBeNull();
    expect(c.error()).toBe('No se pudo confirmar el precio. Probá de nuevo.');
    expect(c.buscando()).toBe(false);
  });
});
