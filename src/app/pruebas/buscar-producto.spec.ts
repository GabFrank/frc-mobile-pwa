import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { EscanerService } from '../core/dispositivo/escaner.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { Producto } from '../domains/productos/producto.model';
import { BuscarPage } from '../pages/buscar/buscar.page';
import { ProductoBusquedaService } from '../pages/buscar/producto-busqueda.service';
import {
  etiquetaPresentacion,
  precioDe,
  resolverPresentacionPorCodigo,
} from '../pages/buscar/presentacion.util';

describe('Buscar producto', () => {
  let busqueda: {
    buscarPorCodigoOTexto: ReturnType<typeof vi.fn>;
    pesable: ReturnType<typeof vi.fn>;
    esPesable: ReturnType<typeof vi.fn>;
    stock: ReturnType<typeof vi.fn>;
  };
  let escaner: { escanear: ReturnType<typeof vi.fn>; disponible: boolean };
  let notificacion: {
    ok: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
  };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const producto = (extra: Partial<Producto> = {}): Producto =>
    Object.assign(new Producto(), {
      id: 1,
      descripcion: 'COCA COLA 2L',
      codigoPrincipal: '7840001',
      ...extra,
    });

  beforeEach(() => {
    localStorage.clear();
    busqueda = {
      buscarPorCodigoOTexto: vi.fn(() => of([])),
      pesable: vi.fn(() => of(null)),
      esPesable: vi.fn(() => false),
      stock: vi.fn(() => of(12)),
    };
    escaner = { escanear: vi.fn(async () => undefined), disponible: true };
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: EscanerService, useValue: escaner },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(BuscarPage);
    f.detectChanges();
    return f;
  };

  it('arranca invitando a buscar, no diciendo que no hay resultados', () => {
    const f = montar();

    expect(texto(f)).toContain('Buscá un producto');
    expect(texto(f)).not.toContain('Sin resultados');
    expect(busqueda.buscarPorCodigoOTexto).not.toHaveBeenCalled();
  });

  it('buscar con el campo vacío no llama al servidor', () => {
    const f = montar();
    f.componentInstance.buscar();

    expect(busqueda.buscarPorCodigoOTexto).not.toHaveBeenCalled();
  });

  it('lista los resultados', () => {
    busqueda.buscarPorCodigoOTexto.mockReturnValue(
      of([producto(), producto({ id: 2, descripcion: 'COCA COLA 1L' })]),
    );
    const f = montar();
    f.componentInstance.texto.set('coca');
    f.componentInstance.buscar();
    f.detectChanges();

    expect(texto(f)).toContain('COCA COLA 2L');
    expect(texto(f)).toContain('COCA COLA 1L');
  });

  it('sin resultados dice qué se buscó', () => {
    const f = montar();
    f.componentInstance.texto.set('nohaynada');
    f.componentInstance.buscar();
    f.detectChanges();

    expect(texto(f)).toContain('Sin resultados');
    expect(texto(f)).toContain('nohaynada');
  });

  it('«Cargar más» aparece solo con una tanda completa', () => {
    busqueda.buscarPorCodigoOTexto.mockReturnValue(
      of(Array.from({ length: 10 }, (_, i) => producto({ id: i + 1 }))),
    );
    const f = montar();
    f.componentInstance.texto.set('coca');
    f.componentInstance.buscar();
    f.detectChanges();

    expect(f.componentInstance.hayMas()).toBe(true);

    // La segunda tanda vuelve corta: no hay más.
    busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto({ id: 99 })]));
    f.componentInstance.cargarMas();
    f.detectChanges();

    expect(f.componentInstance.hayMas()).toBe(false);
    expect(f.componentInstance.resultados().length).toBe(11);
    expect(busqueda.buscarPorCodigoOTexto).toHaveBeenLastCalledWith('coca', 10);
  });

  describe('escaneo', () => {
    it('un código común entra por la búsqueda normal', async () => {
      escaner.escanear.mockResolvedValue('7840001234567');
      const f = montar();
      await f.componentInstance.escanearCodigo();

      expect(busqueda.pesable).not.toHaveBeenCalled();
      expect(busqueda.buscarPorCodigoOTexto).toHaveBeenCalledWith('7840001234567', 0);
    });

    it('pide los formatos de producto, no solo QR', async () => {
      const f = montar();
      await f.componentInstance.escanearCodigo();

      expect(escaner.escanear).toHaveBeenCalledWith(
        expect.objectContaining({ formatos: expect.arrayContaining(['ean_13', 'code_128']) }),
      );
    });

    it('cancelar el escáner no busca nada', async () => {
      escaner.escanear.mockResolvedValue(undefined);
      const f = montar();
      await f.componentInstance.escanearCodigo();

      expect(busqueda.buscarPorCodigoOTexto).not.toHaveBeenCalled();
    });

    it('un pesable no entra por la búsqueda común: se perdería el peso', async () => {
      escaner.escanear.mockResolvedValue('2012345015000');
      busqueda.esPesable.mockReturnValue(true);
      busqueda.pesable.mockReturnValue(
        of({
          producto: producto({ descripcion: 'QUESO PARAGUAY', balanza: true }),
          presentacion: { id: 5, precioPrincipal: { precio: 32_000 } },
          peso: 1.5,
        }),
      );

      const f = montar();
      await f.componentInstance.escanearCodigo();
      f.detectChanges();

      expect(busqueda.buscarPorCodigoOTexto).not.toHaveBeenCalled();
      expect(busqueda.pesable).toHaveBeenCalledWith('2012345015000');
      expect(texto(f)).toContain('QUESO PARAGUAY');
      expect(texto(f)).toContain('1,500 kg');
      // 32.000 por kilo × 1,5 kg
      expect(f.componentInstance.totalPesable()).toBe(48_000);
    });

    it('un pesable sin producto avisa en vez de quedar en blanco', async () => {
      escaner.escanear.mockResolvedValue('2012345015000');
      busqueda.esPesable.mockReturnValue(true);
      busqueda.pesable.mockReturnValue(of(null));

      const f = montar();
      await f.componentInstance.escanearCodigo();

      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('balanza'));
    });
  });

  it('propaga el error al estado de error', () => {
    busqueda.buscarPorCodigoOTexto.mockReturnValue(throwError(() => new Error('sin conexión')));
    const f = montar();
    f.componentInstance.texto.set('coca');
    f.componentInstance.buscar();
    f.detectChanges();

    expect(texto(f)).toContain('sin conexión');
  });

  it('sin sucursal en sesión no consulta stock: avisa', () => {
    const f = montar();
    f.componentInstance.abrir(producto());

    expect(busqueda.stock).not.toHaveBeenCalled();
    expect(notificacion.warn).toHaveBeenCalled();
  });

  it('con sucursal consulta el stock de esa sucursal', () => {
    // La sucursal no se setea sola: viene de `inicioSesion.sucursal` del login.
    TestBed.inject(AuthService).establecerUsuario({
      id: 42,
      inicioSesion: { sucursal: { id: 3, nombre: 'CENTRAL' } },
    } as never);
    const f = montar();
    f.componentInstance.abrir(producto());

    expect(busqueda.stock).toHaveBeenCalledWith(1, 3);
    expect(notificacion.ok).toHaveBeenCalledWith(expect.stringContaining('12'));
  });
});

describe('Presentaciones', () => {
  const conCodigos = (codigos: string[], extra: Record<string, unknown> = {}) => ({
    id: 1,
    codigos: codigos.map((codigo, i) => ({ id: i, codigo })),
    ...extra,
  });

  it('el código elige la presentación, no la primera de la lista', () => {
    const producto = {
      presentaciones: [
        conCodigos(['7840001'], { principal: true, cantidad: 1 }),
        conCodigos(['7840002'], { cantidad: 12 }),
      ],
    } as never;

    // Cobrar la unidad por escanear la caja es el bug que esto evita.
    expect(resolverPresentacionPorCodigo(producto, '7840002')?.cantidad).toBe(12);
  });

  it('sin coincidencia cae en la principal', () => {
    const producto = {
      presentaciones: [conCodigos(['A'], { cantidad: 12 }), conCodigos(['B'], { principal: true, cantidad: 1 })],
    } as never;

    expect(resolverPresentacionPorCodigo(producto, 'NOEXISTE')?.cantidad).toBe(1);
  });

  it('compara los códigos normalizados', () => {
    const producto = { presentaciones: [conCodigos([' abc123 '], { cantidad: 6 })] } as never;

    expect(resolverPresentacionPorCodigo(producto, 'ABC123')?.cantidad).toBe(6);
  });

  it('sin presentaciones devuelve null en vez de romper', () => {
    expect(resolverPresentacionPorCodigo({ presentaciones: [] } as never, 'X')).toBeNull();
  });

  it('el precio principal gana sobre el resto', () => {
    expect(
      precioDe({ precioPrincipal: { precio: 5000 }, precios: [{ precio: 9000 }] } as never),
    ).toBe(5000);
  });

  it('sin principal toma el primer precio activo', () => {
    expect(
      precioDe({ precios: [{ precio: 9000, activo: false }, { precio: 7000 }] } as never),
    ).toBe(7000);
  });

  it('la etiqueta muestra la cantidad solo cuando agrupa', () => {
    const tipo = { descripcion: 'Caja' };
    expect(etiquetaPresentacion({ tipoPresentacion: tipo, cantidad: 12 } as never)).toBe('Caja x12');
    expect(etiquetaPresentacion({ tipoPresentacion: tipo, cantidad: 1 } as never)).toBe('Caja');
  });
});
