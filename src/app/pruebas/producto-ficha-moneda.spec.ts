import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { PrecioMonedaService } from 'src/app/domains/moneda/precio-moneda.service';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { MonedaDePreciosDeProductoGQL } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { ProductoDetallePage } from 'src/app/pages/producto/producto-detalle.page';

/**
 * #148: la ficha mostraba todo precio como guaraníes («₲ 6» para 5,85 USD).
 * Cada precio sale en su moneda, y si no se sabe, sin símbolo: nunca ₲ por
 * descarte.
 */
describe('Ficha del producto: la moneda de cada precio (#148)', () => {
  const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);
  const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 });
  const dolar = { id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 };

  const producto = {
    id: 9,
    descripcion: 'COCA COLA 1.5 L',
    presentaciones: [
      {
        id: 30,
        cantidad: 1,
        precios: [
          { id: 101, precio: 5.85, principal: true, activo: true, tipoPrecio: { descripcion: 'PROMOCION' } },
          { id: 102, precio: 9000, principal: false, activo: true, tipoPrecio: { descripcion: 'MAYORISTA' } },
        ],
      },
    ],
  };

  const montar = (opciones: {
    sesion: { soportado: boolean; listos: boolean; sinRespuesta?: boolean };
    monedas?: () => Observable<unknown>;
  }) => {
    const consultar = vi.fn(opciones.monedas ?? (() => of(undefined)));
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ProductoBusquedaService,
          useValue: { detalle: vi.fn(() => of(producto)), stockPorSucursales: vi.fn(() => of(new Map())) },
        },
        { provide: SucursalService, useValue: { todas: vi.fn(() => of([])) } },
        { provide: AuthService, useValue: { roles: signal([]) } },
        { provide: RoleService, useValue: { tieneAlgunRol: () => false } },
        { provide: DatosService, useValue: { consultar } },
        { provide: PrecioMonedaService, useValue: { listo: vi.fn(async () => undefined) } },
        { provide: MonedaDePreciosDeProductoGQL, useValue: {} },
      ],
    });
    const sesion = TestBed.inject(MonedasSesion);
    sesion.empresa.set(guarani);
    sesion.preciosMonedaSoportado.set(opciones.sesion.soportado);
    sesion.preciosMonedaListos.set(opciones.sesion.listos);
    sesion.preciosMonedaSinRespuesta.set(opciones.sesion.sinRespuesta ?? false);
    const fixture = TestBed.createComponent(ProductoDetallePage);
    fixture.componentRef.setInput('id', '9');
    fixture.detectChanges();
    return { fixture, consultar };
  };

  const lineas = (el: HTMLElement) =>
    [...el.querySelectorAll('.linea')].map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim());

  it('un precio en dólares sale en US$, no en ₲', async () => {
    const { fixture, consultar } = montar({
      sesion: { soportado: true, listos: true },
      monedas: () =>
        of({ id: 9, presentaciones: [{ id: 30, precios: [{ id: 101, moneda: dolar }, { id: 102, moneda: null }] }] }),
    });
    await fixture.whenStable();

    expect(consultar).toHaveBeenCalledWith(expect.anything(), { id: 9 }, expect.objectContaining({ notificarError: false }));
    const [promo, mayorista] = lineas(fixture.nativeElement);
    expect(promo).toContain('US$');
    expect(promo).toContain('5,85');
    expect(promo).not.toContain('₲');
    expect(mayorista).toContain('₲');
  });

  it('contra un central sin la moneda de los precios, todo en ₲ como siempre', async () => {
    const { fixture, consultar } = montar({ sesion: { soportado: false, listos: true } });
    await fixture.whenStable();

    expect(consultar).not.toHaveBeenCalled();
    expect(lineas(fixture.nativeElement).every((l) => l.includes('₲'))).toBe(true);
  });

  it('la lectura por producto con error de GraphQL (central viejo): ₲', async () => {
    const { fixture } = montar({
      sesion: { soportado: false, listos: true, sinRespuesta: true },
      monedas: () => throwError(
          () => new CombinedGraphQLErrors({ data: null, errors: [{ message: 'campo desconocido' }] as never }),
        ),
    });
    await fixture.whenStable();

    expect(lineas(fixture.nativeElement).every((l) => l.includes('₲'))).toBe(true);
  });

  it('sin respuesta de la sesión ni del producto: el número sin símbolo y «Moneda sin confirmar»', async () => {
    const { fixture } = montar({
      sesion: { soportado: false, listos: true, sinRespuesta: true },
      monedas: () => throwError(() => new TypeError('Failed to fetch')),
    });
    await fixture.whenStable();

    const [promo] = lineas(fixture.nativeElement);
    expect(promo).toContain('5,85');
    expect(promo).toContain('Moneda sin confirmar');
    expect(promo).not.toContain('₲');
  });

  it('mientras la lista de la sesión no llegó, no muestra ₲ por descarte', async () => {
    const { fixture } = montar({ sesion: { soportado: false, listos: false } });
    await fixture.whenStable();

    const [promo] = lineas(fixture.nativeElement);
    expect(promo).toContain('Moneda sin confirmar');
    expect(promo).not.toContain('₲');
  });
});
