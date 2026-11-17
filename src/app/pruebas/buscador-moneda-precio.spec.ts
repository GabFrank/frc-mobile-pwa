import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { PrecioMonedaService } from 'src/app/domains/moneda/precio-moneda.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { Producto } from 'src/app/domains/productos/producto.model';
import { BuscadorProductoComponent } from 'src/app/shared/producto/buscador-producto.component';
import {
  monedaDePrecioEscogido,
  precioConIdEscogido,
} from 'src/app/shared/producto/presentacion.util';

/**
 * #152: la card del buscador y el pesable mostraban todo precio como
 * guaraníes («₲ 6» para 5,85 USD). Cada precio sale en su moneda, y si no se
 * sabe, sin símbolo: nunca ₲ por descarte.
 */
describe('Buscador: la moneda del precio (#152)', () => {
  const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);
  const guarani = moneda({ id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 });
  const dolar = moneda({ id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });

  // `precioPrincipal` llega con el id de la presentación (#142): 30, no 101.
  const presentacionUsd = {
    id: 30,
    cantidad: 1,
    principal: true,
    tipoPresentacion: { descripcion: 'Unidad' },
    codigos: [{ id: 1, codigo: '7840058000675', principal: true }],
    precioPrincipal: { id: 30, precio: 5.85 },
    precios: [{ id: 101, precio: 5.85, principal: true, activo: true }],
  };
  const coca = Object.assign(new Producto(), { id: 9, descripcion: 'COCA COLA 1.5 L', codigoPrincipal: '7840058000675' });

  type Estado = { soportado: boolean; listos: boolean; sinRespuesta?: boolean };

  const configurar = (estado: Estado, busqueda: Record<string, unknown> = {}) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ProductoBusquedaService,
          useValue: {
            buscarPorCodigoOTexto: vi.fn(() => of([coca])),
            detalle: vi.fn(() => of({ ...coca, presentaciones: [presentacionUsd] })),
            esPesable: vi.fn(() => false),
            pesable: vi.fn(() => of(null)),
            stock: vi.fn(() => of(0)),
            ...busqueda,
          },
        },
        { provide: EscanerService, useValue: { escanear: vi.fn(), disponible: true } },
        { provide: NotificacionService, useValue: { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() } },
        { provide: DialogoService, useValue: { abrir: vi.fn() } },
        { provide: PrecioMonedaService, useValue: { listo: vi.fn(async () => undefined) } },
      ],
    });
    const sesion = TestBed.inject(MonedasSesion);
    sesion.empresa.set(guarani);
    sesion.preciosOtraMoneda.set(new Map([['101', dolar]]));
    sesion.preciosMonedaSoportado.set(estado.soportado);
    sesion.preciosMonedaListos.set(estado.listos);
    sesion.preciosMonedaSinRespuesta.set(estado.sinRespuesta ?? false);
    return sesion;
  };

  const texto = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ');

  /** Busca y abre la card: el precio sale en las presentaciones. */
  const cardAbierta = (estado: Estado) => {
    configurar(estado);
    const f = TestBed.createComponent(BuscadorProductoComponent);
    f.componentRef.setInput('opciones', { mostrarPrecio: true });
    f.detectChanges();
    f.componentInstance.texto.set('coca');
    f.componentInstance.buscar();
    f.detectChanges();
    f.componentInstance.alternar(f.componentInstance.resultados()[0]);
    f.detectChanges();
    return texto(f.nativeElement.querySelector('.presentaciones'));
  };

  it('la card muestra un precio en dólares en US$, no en ₲', () => {
    const precio = cardAbierta({ soportado: true, listos: true });

    expect(precio).toContain('US$ 5,85');
    expect(precio).not.toContain('₲');
  });

  it('con un central viejo la card sigue en ₲, como siempre', () => {
    const precio = cardAbierta({ soportado: false, listos: true });

    expect(precio).toContain('₲ 6');
    expect(precio).not.toContain('sin confirmar');
  });

  it('mientras la lista de la sesión no llegó, el número sin símbolo', () => {
    const precio = cardAbierta({ soportado: false, listos: false });

    expect(precio).toContain('5,85');
    expect(precio).toContain('Moneda sin confirmar');
    expect(precio).not.toContain('₲');
  });

  it('el pesable en dólares muestra el precio y el total con centavos', () => {
    configurar(
      { soportado: true, listos: true },
      {
        esPesable: vi.fn(() => true),
        pesable: vi.fn(() =>
          of({
            producto: Object.assign(new Producto(), { id: 9, descripcion: 'QUESO', balanza: true }),
            presentacion: presentacionUsd,
            peso: 0.5,
          }),
        ),
      },
    );
    const f = TestBed.createComponent(BuscadorProductoComponent);
    f.detectChanges();
    f.componentInstance.resolverCodigo('2012345005000');
    f.detectChanges();
    const pesable = texto(f.nativeElement.querySelector('.pesable'));

    expect(pesable).toContain('US$ 5,85');
    // 5,85 × 0,5 = 2,925: en dólares no se redondea a entero.
    expect(pesable).toContain('US$ 2,93');
    expect(pesable).not.toContain('₲');
  });

  it('el pesable sin saber la moneda: los números solos y el chip', () => {
    configurar(
      { soportado: true, listos: true, sinRespuesta: true },
      {
        esPesable: vi.fn(() => true),
        pesable: vi.fn(() =>
          of({
            producto: Object.assign(new Producto(), { id: 9, descripcion: 'QUESO', balanza: true }),
            presentacion: presentacionUsd,
            peso: 0.5,
          }),
        ),
      },
    );
    const f = TestBed.createComponent(BuscadorProductoComponent);
    f.detectChanges();
    f.componentInstance.resolverCodigo('2012345005000');
    f.detectChanges();
    const pesable = texto(f.nativeElement.querySelector('.pesable').parentElement);

    expect(pesable).toContain('5,85');
    expect(pesable).toContain('Moneda sin confirmar');
    expect(pesable).not.toContain('₲');
  });

  describe('monedaDePrecioEscogido', () => {
    it('un principal inactivo que la sesión no conoce: no se sabe', () => {
      const inactivo = {
        ...presentacionUsd,
        precioPrincipal: { id: 30, precio: 4.39 },
        precios: [{ id: 102, precio: 4.39, principal: true, activo: false }],
      };
      expect(monedaDePrecioEscogido(inactivo as never, estado({ soportado: true, listos: true }))).toBeUndefined();
    });

    const estado = (e: Estado) => configurar(e);

    it('con el id real del precio, la moneda de la sesión', () => {
      expect(monedaDePrecioEscogido(presentacionUsd as never, estado({ soportado: true, listos: true }))).toBe(
        dolar,
      );
    });

    it('nunca busca con el id de la presentación que trae precioPrincipal', () => {
      const soloPrincipal = { id: 101, precioPrincipal: { id: 101, precio: 5.85 } };
      const sesion = estado({ soportado: true, listos: true });

      expect(precioConIdEscogido(soloPrincipal as never)).toBeNull();
      // El 101 de la sesión es un precio, no esta presentación: no se sabe.
      expect(monedaDePrecioEscogido(soloPrincipal as never, sesion)).toBeUndefined();
    });

    it('sin id y con un central viejo, la de la empresa', () => {
      const soloPrincipal = { id: 30, precioPrincipal: { id: 30, precio: 12_000 } };
      expect(monedaDePrecioEscogido(soloPrincipal as never, estado({ soportado: false, listos: true }))).toBeNull();
    });

    it('sin id y con la lista sin llegar, no se sabe', () => {
      const soloPrincipal = { id: 30, precioPrincipal: { id: 30, precio: 12_000 } };
      expect(
        monedaDePrecioEscogido(soloPrincipal as never, estado({ soportado: false, listos: false })),
      ).toBeUndefined();
    });

    it('si la lista de la sesión no respondió, no se sabe', () => {
      expect(
        monedaDePrecioEscogido(
          presentacionUsd as never,
          estado({ soportado: true, listos: true, sinRespuesta: true }),
        ),
      ).toBeUndefined();
    });
  });
});
