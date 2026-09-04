import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscanerService } from '../core/dispositivo/escaner.service';
import {
  esSucursalOperable,
  esSucursalOperableId,
  soloOperables,
} from '../domains/empresarial/sucursal/sucursal.util';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { Producto } from '../domains/productos/producto.model';
import { BuscadorProductoComponent } from '../shared/producto/buscador-producto.component';
import { OpcionesBuscador } from '../shared/producto/buscador.types';
import {
  etiquetaPresentacion,
  precioDe,
  resolverPresentacionPorCodigo,
} from '../shared/producto/presentacion.util';

describe('Buscador de producto', () => {
  let busqueda: {
    buscarPorCodigoOTexto: ReturnType<typeof vi.fn>;
    pesable: ReturnType<typeof vi.fn>;
    esPesable: ReturnType<typeof vi.fn>;
    stock: ReturnType<typeof vi.fn>;
    detalle: ReturnType<typeof vi.fn>;
  };
  let escaner: { escanear: ReturnType<typeof vi.fn>; disponible: boolean };
  let notificacion: {
    ok: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
  };
  let dialogo: { abrir: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const producto = (extra: Partial<Producto> = {}): Producto =>
    Object.assign(new Producto(), {
      id: 1,
      descripcion: 'COCA COLA 2L',
      codigoPrincipal: '7840001',
      ...extra,
    });

  const presentacion = (extra: Record<string, unknown> = {}) => ({
    id: 10,
    cantidad: 1,
    principal: true,
    tipoPresentacion: { descripcion: 'Unidad' },
    precioPrincipal: { precio: 12_000 },
    codigos: [{ id: 1, codigo: '7840001', principal: true }],
    ...extra,
  });

  beforeEach(() => {
    localStorage.clear();
    busqueda = {
      buscarPorCodigoOTexto: vi.fn(() => of([])),
      pesable: vi.fn(() => of(null)),
      esPesable: vi.fn(() => false),
      stock: vi.fn(() => of(24)),
      detalle: vi.fn(() => of(producto({ presentaciones: [presentacion()] as never }))),
    };
    escaner = { escanear: vi.fn(async () => undefined), disponible: true };
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };
    dialogo = { abrir: vi.fn(async () => undefined) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: EscanerService, useValue: escaner },
        { provide: NotificacionService, useValue: notificacion },
        { provide: DialogoService, useValue: dialogo },
      ],
    });
  });

  const montar = (opciones: OpcionesBuscador = {}) => {
    const f = TestBed.createComponent(BuscadorProductoComponent);
    f.componentRef.setInput('opciones', opciones);
    f.detectChanges();
    return f;
  };

  const buscarPor = (f: ReturnType<typeof montar>, consulta: string) => {
    f.componentInstance.texto.set(consulta);
    f.componentInstance.buscar();
    f.detectChanges();
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
    buscarPor(f, 'coca');

    expect(texto(f)).toContain('COCA COLA 2L');
    expect(texto(f)).toContain('COCA COLA 1L');
  });

  it('sin resultados dice qué se buscó', () => {
    const f = montar();
    buscarPor(f, 'nohaynada');

    expect(texto(f)).toContain('Sin resultados');
    expect(texto(f)).toContain('nohaynada');
  });

  it('cancela la búsqueda anterior antes de lanzar otra', () => {
    // El repo anterior solo limpiaba el timer del debounce: si dos búsquedas
    // llegaban a salir, ganaba la que contestara última, no la que se pidió
    // última.
    const primera = new Subject<Producto[]>();
    busqueda.buscarPorCodigoOTexto.mockReturnValueOnce(primera);
    const f = montar();
    buscarPor(f, 'coca');

    busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto({ descripcion: 'PEPSI' })]));
    buscarPor(f, 'pepsi');

    // La primera contesta tarde: ya no debe pisar nada.
    primera.next([producto({ descripcion: 'VIEJA' })]);
    f.detectChanges();

    expect(texto(f)).toContain('PEPSI');
    expect(texto(f)).not.toContain('VIEJA');
  });

  it('«Cargar más» aparece solo con una tanda completa', () => {
    busqueda.buscarPorCodigoOTexto.mockReturnValue(
      of(Array.from({ length: 10 }, (_, i) => producto({ id: i + 1 }))),
    );
    const f = montar();
    buscarPor(f, 'coca');

    expect(f.componentInstance.hayMas()).toBe(true);

    busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto({ id: 99 })]));
    f.componentInstance.cargarMas();
    f.detectChanges();

    expect(f.componentInstance.hayMas()).toBe(false);
    expect(f.componentInstance.resultados().length).toBe(11);
    expect(busqueda.buscarPorCodigoOTexto).toHaveBeenLastCalledWith('coca', 10);
  });

  describe('expandir la card', () => {
    it('carga presentaciones recién al abrir, no en la búsqueda', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      const f = montar();
      buscarPor(f, 'coca');

      expect(busqueda.detalle).not.toHaveBeenCalled();

      f.componentInstance.alExpandir(producto());
      f.detectChanges();

      expect(busqueda.detalle).toHaveBeenCalledWith(1);
      expect(f.componentInstance.resultados()[0].presentaciones?.length).toBe(1);
    });

    it('no vuelve a pedir el detalle si ya trae presentaciones', () => {
      const conPresentaciones = producto({ presentaciones: [presentacion()] as never });
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([conPresentaciones]));
      const f = montar();
      buscarPor(f, 'coca');
      f.componentInstance.alExpandir(conPresentaciones);

      expect(busqueda.detalle).not.toHaveBeenCalled();
    });

    it('sin sucursal no consulta stock ni lo muestra', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      const f = montar({});
      buscarPor(f, 'coca');
      f.componentInstance.alExpandir(producto());

      expect(busqueda.stock).not.toHaveBeenCalled();
      expect(f.componentInstance.stockDe(producto())).toBeNull();
    });

    it('con sucursal consulta el stock una sola vez', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      const f = montar({ sucursalId: 3 });
      buscarPor(f, 'coca');

      f.componentInstance.alExpandir(producto());
      f.componentInstance.alExpandir(producto());

      expect(busqueda.stock).toHaveBeenCalledTimes(1);
      expect(busqueda.stock).toHaveBeenCalledWith(1, 3);
      expect(f.componentInstance.stockDe(producto())).toBe(24);
    });

    it('un stock que falla no rompe la card', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      busqueda.stock.mockReturnValue(throwError(() => new Error('caído')));
      const f = montar({ sucursalId: 3 });
      buscarPor(f, 'coca');
      f.componentInstance.alExpandir(producto());
      f.detectChanges();

      expect(texto(f)).toContain('COCA COLA 2L');
      expect(texto(f)).not.toContain('No se pudieron cargar');
    });
  });

  describe('qué devuelve', () => {
    it('modo presentación: emite producto y presentación', () => {
      const f = montar({ devuelve: 'presentacion' });
      const emitido = vi.fn();
      f.componentInstance.seleccion.subscribe(emitido);

      f.componentInstance.elegirPresentacion(producto(), presentacion() as never);

      expect(emitido).toHaveBeenCalledWith(
        expect.objectContaining({ producto: expect.objectContaining({ id: 1 }) }),
      );
      expect(emitido.mock.calls[0][0].presentacion).toBeTruthy();
    });

    it('modo producto: la card no se expande', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      const f = montar({ devuelve: 'producto' });
      buscarPor(f, 'coca');

      // Sin chevron no hay nada que expandir: tocar la card elige y basta.
      expect(f.nativeElement.querySelector('.chevron')).toBeFalsy();
    });

    it('modo presentación: la card sí se expande', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto()]));
      const f = montar({ devuelve: 'presentacion' });
      buscarPor(f, 'coca');

      expect(f.nativeElement.querySelector('.chevron')).toBeTruthy();
    });
  });

  describe('menú de acciones', () => {
    it('siempre ofrece ver stock por sucursal', () => {
      const f = montar();
      expect(f.componentInstance.accionesDe().map((a) => a.id)).toContain('stock');
    });

    it('suma las acciones que declaró el llamador, después de las propias', () => {
      const f = montar({ acciones: [{ id: 'ajustar', etiqueta: 'Ajustar stock' }] });
      // Las propias del buscador van primero y las del llamador después:
      // «ver ficha» y «ver stock» están en todas las pantallas que lo montan,
      // así que quedan siempre en el mismo lugar del menú.
      expect(f.componentInstance.accionesDe().map((a) => a.id)).toEqual([
        'ficha',
        'stock',
        'ajustar',
      ]);
    });

    it('«ver stock» lo resuelve el buscador, no el llamador', async () => {
      const f = montar({ sucursalId: 3 });
      const emitido = vi.fn();
      f.componentInstance.seleccion.subscribe(emitido);

      await f.componentInstance.ejecutarAccion('stock', producto());

      expect(dialogo.abrir).toHaveBeenCalled();
      expect(emitido).not.toHaveBeenCalled();
    });

    it('una acción del llamador sale por (seleccion)', async () => {
      const f = montar();
      const emitido = vi.fn();
      f.componentInstance.seleccion.subscribe(emitido);

      await f.componentInstance.ejecutarAccion('ajustar', producto());

      expect(emitido).toHaveBeenCalled();
    });
  });

  describe('escaneo', () => {
    it('un código común entra por la búsqueda normal', async () => {
      escaner.escanear.mockResolvedValue('7840001234567');
      const f = montar();
      await f.componentInstance.escanear();

      expect(busqueda.pesable).not.toHaveBeenCalled();
      expect(busqueda.buscarPorCodigoOTexto).toHaveBeenCalledWith('7840001234567', 0);
    });

    it('pide los formatos de producto, no solo QR', async () => {
      const f = montar();
      await f.componentInstance.escanear();

      expect(escaner.escanear).toHaveBeenCalledWith(
        expect.objectContaining({ formatos: expect.arrayContaining(['ean_13', 'code_128']) }),
      );
    });

    it('cancelar el escáner no busca nada', async () => {
      escaner.escanear.mockResolvedValue(undefined);
      const f = montar();
      await f.componentInstance.escanear();

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
      const emitido = vi.fn();
      f.componentInstance.seleccion.subscribe(emitido);

      await f.componentInstance.escanear();
      f.detectChanges();

      expect(busqueda.buscarPorCodigoOTexto).not.toHaveBeenCalled();
      expect(texto(f)).toContain('1,500 kg');
      expect(f.componentInstance.totalPesable()).toBe(48_000);
      // Un pesable ya resolvió presentación y peso: no hay nada que elegir.
      expect(emitido).toHaveBeenCalledWith(expect.objectContaining({ peso: 1.5 }));
    });

    it('un pesable sin producto avisa en vez de quedar en blanco', async () => {
      escaner.escanear.mockResolvedValue('2012345015000');
      busqueda.esPesable.mockReturnValue(true);
      busqueda.pesable.mockReturnValue(of(null));

      const f = montar();
      await f.componentInstance.escanear();

      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('balanza'));
    });
  });

  describe('la foto del producto', () => {
    // El central manda imagenPrincipal como data:image/jpg;base64,… — no una
    // URL—, así que la card lo pone tal cual en el src. Ver ImageService.
    const FOTO = 'data:image/jpg;base64,/9j/4AAQSkZJRg==';

    const miniaturas = (f: { nativeElement: HTMLElement }) =>
      Array.from(f.nativeElement.querySelectorAll<HTMLImageElement>('.thumb img'));

    it('muestra la foto cuando el producto la trae', () => {
      busqueda.buscarPorCodigoOTexto.mockReturnValue(of([producto({ imagenPrincipal: FOTO })]));
      const f = montar();
      buscarPor(f, 'coca');

      expect(miniaturas(f).map((i) => i.getAttribute('src'))).toEqual([FOTO]);
    });

    it('sin foto deja el ícono, no una imagen vacía', () => {
      // Un src="" hace que el navegador vuelva a pedir la página actual como
      // si fuera una imagen, así que la cadena vacía tiene que caer al ícono
      // igual que el null.
      busqueda.buscarPorCodigoOTexto.mockReturnValue(
        of([producto(), producto({ id: 2, imagenPrincipal: '   ' })]),
      );
      const f = montar();
      buscarPor(f, 'coca');

      expect(miniaturas(f)).toHaveLength(0);
      expect(f.nativeElement.querySelectorAll('.thumb svg')).toHaveLength(2);
    });

    it('una foto rota no apaga la del producto que ocupe esa fila después', () => {
      // @for reusa la instancia de la card entre búsquedas: sin reponer el
      // estado al cambiar de producto, el primer error dejaba sin foto a
      // todos los siguientes.
      busqueda.buscarPorCodigoOTexto.mockReturnValue(
        of([producto({ id: 1, imagenPrincipal: 'data:image/jpg;base64,rota' })]),
      );
      const f = montar();
      buscarPor(f, 'coca');
      miniaturas(f)[0].dispatchEvent(new Event('error'));
      f.detectChanges();
      expect(miniaturas(f)).toHaveLength(0);

      busqueda.buscarPorCodigoOTexto.mockReturnValue(
        of([producto({ id: 2, imagenPrincipal: FOTO })]),
      );
      buscarPor(f, 'pepsi');

      expect(miniaturas(f).map((i) => i.getAttribute('src'))).toEqual([FOTO]);
    });
  });

  it('propaga el error al estado de error', () => {
    busqueda.buscarPorCodigoOTexto.mockReturnValue(throwError(() => new Error('sin conexión')));
    const f = montar();
    buscarPor(f, 'coca');

    expect(texto(f)).toContain('sin conexión');
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
      presentaciones: [
        conCodigos(['A'], { cantidad: 12 }),
        conCodigos(['B'], { principal: true, cantidad: 1 }),
      ],
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

  it('la etiqueta lidera con la cantidad, que es el dato principal', () => {
    const tipo = { descripcion: 'Caja' };
    expect(etiquetaPresentacion({ tipoPresentacion: tipo, cantidad: 12 } as never)).toBe(
      'Cantidad: 12 (Caja)',
    );
  });

  it('la descripción propia gana sobre la del tipo', () => {
    expect(
      etiquetaPresentacion({
        descripcion: 'Pack promo',
        tipoPresentacion: { descripcion: 'Caja' },
        cantidad: 6,
      } as never),
    ).toBe('Cantidad: 6 (Pack promo)');
  });

  it('sin descripción no deja un paréntesis vacío', () => {
    expect(etiquetaPresentacion({ cantidad: 1 } as never)).toBe('Cantidad: 1');
  });

  it('una cantidad fraccionada conserva sus decimales, con coma', () => {
    // Coma decimal: es es-PY. Con el pipe `number` de Angular saldría "0.50".
    expect(etiquetaPresentacion({ cantidad: 0.5 } as never)).toBe('Cantidad: 0,50');
  });
});

describe('Sucursales operables', () => {
  /**
   * Lo que decide es `deposito`: con depósito la sucursal mueve stock y
   * participa de las operaciones; sin depósito es virtual. En la base son
   * exactamente dos las virtuales — SERVIDOR (0) y COMPRAS (999) —, y las dos
   * vienen `activo = true`.
   */
  const SERVIDOR = { id: 0, nombre: 'SERVIDOR', deposito: false, activo: true };
  const COMPRAS = { id: 999, nombre: 'COMPRAS', deposito: false, activo: true };
  const CENTRAL = { id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true };
  const CERRADA = { id: 15, nombre: 'SUC. SAN PEDRO', deposito: true, activo: false };

  it('sin depósito no opera, aunque esté activa', () => {
    expect(esSucursalOperable(SERVIDOR)).toBe(false);
    expect(esSucursalOperable(COMPRAS)).toBe(false);
  });

  it('con depósito y activa, sí', () => {
    expect(esSucursalOperable(CENTRAL)).toBe(true);
  });

  it('una sucursal cerrada no recibe operaciones nuevas', () => {
    // `activo` es otra dimensión: hay 8 con depósito que están cerradas.
    expect(esSucursalOperable(CERRADA)).toBe(false);
  });

  it('sin sucursal no hay nada que decidir', () => {
    expect(esSucursalOperable(null)).toBe(false);
    expect(esSucursalOperable(undefined)).toBe(false);
  });

  it('soloOperables deja las que pueden trabajar', () => {
    expect(soloOperables([SERVIDOR, COMPRAS, CERRADA, CENTRAL]).map((s) => s.id)).toEqual([1]);
  });

  it('resolver por id compara por valor: GraphQL manda strings', () => {
    const todas = [SERVIDOR, CENTRAL];
    // La sucursal de la sesión llega como "0": un === contra 0 la dejaría
    // pasar, que es justo el caso a bloquear.
    expect(esSucursalOperableId('0', todas)).toBe(false);
    expect(esSucursalOperableId('1', todas)).toBe(true);
    expect(esSucursalOperableId(1, todas)).toBe(true);
  });

  it('un id que no está en la lista no opera', () => {
    expect(esSucursalOperableId(77, [CENTRAL])).toBe(false);
  });
});
