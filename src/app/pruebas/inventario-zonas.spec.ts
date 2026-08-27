import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { SectorService } from '../domains/sector/sector.service';
import { ZonaService } from '../domains/zona/zona.service';
import { TransferenciaEstado } from '../domains/transferencia/transferencia.model';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import type { Zona } from '../domains/zona/zona.model';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import type { InventarioProducto } from '../domains/inventario/inventario.model';
import { InventarioDetallePage } from '../pages/inventario/inventario-detalle.page';
import { InventarioService } from '../pages/inventario/inventario.service';

/**
 * Las zonas de una toma abierta: agregarlas, concluirlas y reabrirlas.
 */
describe('Zonas de la toma', () => {
  let servicio: {
    porId: ReturnType<typeof vi.fn>;
    guardarZona: ReturnType<typeof vi.fn>;
    finalizar: ReturnType<typeof vi.fn>;
  };
  let sectores: { deSucursal: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let zonas: { guardar: ReturnType<typeof vi.fn> };
  let transferencias: { conFiltros: ReturnType<typeof vi.fn> };
  let dialogo: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };

  const inventario = (estado: InventarioEstado, zonas: unknown[]) => ({
    id: 5,
    estado,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: zonas,
  });

  const ZONA_ABIERTA: InventarioProducto = {
    id: 91,
    concluido: false,
    zona: { id: 11, descripcion: 'estante alto', sector: { id: 1, descripcion: 'gondola' } } as Zona,
    inventarioProductoItemList: [],
  };
  const ZONA_CONCLUIDA: InventarioProducto = {
    id: 92,
    concluido: true,
    zona: { id: 12, descripcion: 'estante bajo', sector: { id: 1, descripcion: 'gondola' } } as Zona,
    inventarioProductoItemList: [],
  };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [ZONA_ABIERTA]))),
      guardarZona: vi.fn(() => of({ id: 91 })),
      finalizar: vi.fn(() => of({ id: 5 })),
    };
    sectores = { deSucursal: vi.fn(() => of([])), guardar: vi.fn(() => of({ id: 55 })) };
    zonas = { guardar: vi.fn(() => of({ id: 77 })) };
    transferencias = { conFiltros: vi.fn(() => of({ getTotalElements: 0 })) };
    dialogo = { confirmar: vi.fn(async () => true), abrir: vi.fn(async () => undefined) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: SectorService, useValue: sectores },
        { provide: ZonaService, useValue: zonas },
        { provide: TransferenciaService, useValue: transferencias },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(InventarioDetallePage);
    f.componentRef.setInput('id', '5');
    f.detectChanges();
    return f;
  };

  /**
   * Regresión: los tres botones vivían en un solo `@if` con varios nodos
   * raíz. Angular no los proyecta al slot en ese caso y quedan sueltos en el
   * cuerpo de la card — lo avisa con **NG8011, que es un warning**, así que
   * el build pasa igual y solo se ve mirando la pantalla.
   *
   * Por eso se mira **dónde** está el botón, no si su texto aparece: con la
   * proyección rota el texto está igual, en el lugar equivocado.
   */
  it('los botones de zona van al pie de la card, no sueltos en el cuerpo', () => {
    const f = montar();
    const pie = f.nativeElement.querySelector('frc-card .pie') as HTMLElement | null;

    expect(pie).not.toBeNull();
    const textos = [...pie!.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(textos).toContain('Contar');
    expect(textos).toContain('Concluir');
  });

  /** El botón «Agregar zona» del cuerpo, con el mismo trato que un «Cargar más». */
  const botonAgregarZona = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelector('button.mas') as HTMLButtonElement | null;

  it('«Agregar zona» va al final de la lista, no en la barra fija', () => {
    // Estaba solo en el menú ⋮ de la barra superior, que es donde nadie lo
    // busca: agregar una zona es la acción con la que ARRANCA una toma. En la
    // barra fija quedaba apilada arriba de «Finalizar inventario» y le robaba
    // peso al único botón que cierra la toma.
    const f = montar();

    expect(botonAgregarZona(f)?.textContent?.trim()).toBe('Agregar zona');

    const pie = f.nativeElement.querySelector('footer.acciones') as HTMLElement;
    const enLaBarra = [...pie.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(enLaBarra).not.toContain('Agregar zona');
  });

  it('está también con la toma sin zonas, que es cuando más hace falta', () => {
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [])));
    const f = montar();

    expect(botonAgregarZona(f)).not.toBeNull();
  });

  it('el botón abre el diálogo de zona', async () => {
    const f = montar();

    botonAgregarZona(f)!.click();
    await f.whenStable();

    expect(dialogo.abrir).toHaveBeenCalled();
  });

  it('con la toma cerrada no aparece «Agregar zona»', () => {
    // El alcance de una toma cerrada ya es un hecho histórico.
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO, [ZONA_CONCLUIDA])));
    const f = montar();

    expect(botonAgregarZona(f)).toBeNull();
  });

  it('una zona concluida ofrece reabrir en vez de concluir', () => {
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [ZONA_CONCLUIDA])));
    const f = montar();
    const pie = f.nativeElement.querySelector('frc-card .pie') as HTMLElement;
    const textos = [...pie.querySelectorAll('button')].map((b) => b.textContent?.trim());

    expect(textos).toContain('Reabrir');
    expect(textos).not.toContain('Concluir');
  });

  it('con la toma cerrada no hay ningún botón de escritura', () => {
    // Un conteo cerrado es un hecho histórico: escribir encima cambiaría el
    // resultado de una toma que ya ajustó el stock.
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO, [ZONA_ABIERTA])));
    const f = montar();
    const texto = f.nativeElement.textContent ?? '';

    expect(texto).not.toContain('Agregar zona');
    expect(texto).not.toContain('Contar');
    expect(texto).not.toContain('Concluir');
  });

  it('reabrir con otra zona sin concluir queda bloqueado', async () => {
    servicio.porId = vi.fn(() =>
      of(inventario(InventarioEstado.ABIERTO, [ZONA_ABIERTA, ZONA_CONCLUIDA])),
    );
    const f = montar();
    await f.componentInstance.marcarZona(ZONA_CONCLUIDA, false);

    // Dos zonas en curso mezclan los conteos: es la regla de `verificarAbiertos`.
    expect(notificacion.warn).toHaveBeenCalled();
    expect(servicio.guardarZona).not.toHaveBeenCalled();
  });

  it('concluir manda el id del renglón, para actualizar y no duplicar', async () => {
    const f = montar();
    await f.componentInstance.marcarZona(ZONA_ABIERTA, true);

    expect(servicio.guardarZona).toHaveBeenCalledWith({
      id: 91,
      inventarioId: 5,
      zonaId: 11,
      concluido: true,
    });
  });

  it('no se finaliza la toma con una zona sin concluir', async () => {
    // Finalizar ESCRIBE los ajustes de stock y reabrir la toma no los deshace:
    // con una zona abierta se estaría ajustando contra un conteo a medio hacer.
    const f = montar();

    await f.componentInstance.finalizar();

    expect(servicio.finalizar).not.toHaveBeenCalled();
    expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('estante alto'));
    // Ni siquiera se abre la confirmación: no hay nada que confirmar.
    expect(dialogo.confirmar).not.toHaveBeenCalled();
  });

  it('con todas las zonas concluidas sí se finaliza', async () => {
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [ZONA_CONCLUIDA])));
    const f = montar();

    await f.componentInstance.finalizar();

    expect(servicio.finalizar).toHaveBeenCalledWith(5);
  });

  it('no se concluye una zona con un renglón sin contar', async () => {
    // «Concluida» afirma que ahí ya se contó todo. Con un renglón vacío la
    // afirmación es falsa Y tiene consecuencia: el central saltea ese ítem al
    // finalizar, así que su producto no se ajusta y nadie se entera.
    const conVacio: InventarioProducto = {
      ...ZONA_ABIERTA,
      inventarioProductoItemList: [
        {
          id: 500,
          cantidad: 6,
          presentacion: { id: 9, cantidad: 1, producto: { id: 200, descripcion: 'COCA COLA 2L' } },
        },
        {
          id: 501,
          presentacion: { id: 8, cantidad: 1, producto: { id: 300, descripcion: 'DUCOCO AGUA' } },
        },
      ],
    } as InventarioProducto;
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [conVacio])));
    const f = montar();

    await f.componentInstance.marcarZona(conVacio, true);

    expect(servicio.guardarZona).not.toHaveBeenCalled();
    expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('DUCOCO AGUA'));
  });

  it('con todo contado sí se concluye, y el cero cuenta', async () => {
    // Cero es un conteo —«no hay nada en la góndola»— y ajusta el stock.
    const contada: InventarioProducto = {
      ...ZONA_ABIERTA,
      inventarioProductoItemList: [
        {
          id: 500,
          cantidad: 0,
          presentacion: { id: 9, cantidad: 1, producto: { id: 200, descripcion: 'COCA COLA 2L' } },
        },
      ],
    } as InventarioProducto;
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [contada])));
    const f = montar();

    await f.componentInstance.marcarZona(contada, true);

    expect(servicio.guardarZona).toHaveBeenCalled();
  });

  it('reabrir una zona no exige nada: se reabre justamente para completarla', async () => {
    const conVacio: InventarioProducto = {
      ...ZONA_CONCLUIDA,
      inventarioProductoItemList: [
        {
          id: 501,
          presentacion: { id: 8, cantidad: 1, producto: { id: 300, descripcion: 'DUCOCO AGUA' } },
        },
      ],
    } as InventarioProducto;
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [conVacio])));
    const f = montar();

    await f.componentInstance.marcarZona(conVacio, false);

    expect(servicio.guardarZona).toHaveBeenCalled();
  });

  it('agregar una zona la da de alta sin id', async () => {
    sectores.deSucursal = vi.fn(() =>
      of([
        {
          id: 1,
          descripcion: 'gondola',
          zonaList: [
            { id: 11, descripcion: 'estante alto', activo: true },
            { id: 12, descripcion: 'estante bajo', activo: true },
          ],
        },
      ]),
    );
    dialogo.abrir = vi.fn(async () => ({ accion: 'elegir', zonaId: 12 }));

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    // La 11 ya está en la toma, así que el diálogo solo recibe la 12.
    const datos = dialogo.abrir.mock.calls[0][1] as { disponibles: { zonaId: number }[] };
    expect(datos.disponibles.map((z) => z.zonaId)).toEqual([12]);

    expect(servicio.guardarZona).toHaveBeenCalledWith({
      inventarioId: 5,
      zonaId: 12,
      concluido: false,
    });
  });

  /**
   * Crear al paso lo que falta para poder contar.
   *
   * Sin esto, encontrarse con que la zona no existe obliga a salir del
   * inventario, ir a Lugares del depósito, crearla y volver — con la
   * mercadería delante. `frc-mobile` lo resuelve anidando la gestión de
   * lugares adentro de la toma; acá se crea solamente lo que hace falta.
   */
  const SECTORES = [
    { id: 1, descripcion: 'gondola', zonaList: [{ id: 11, descripcion: 'estante alto', activo: true }] },
  ];

  it('crear una zona en un sector que ya existe la suma a la toma', async () => {
    sectores.deSucursal = vi.fn(() => of(SECTORES));
    dialogo.abrir = vi.fn(async () => ({
      accion: 'crear',
      descripcion: 'RACK NUEVO',
      sectorId: 1,
    }));

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    // No crea sector: ya había uno elegido.
    expect(sectores.guardar).not.toHaveBeenCalled();
    expect(zonas.guardar).toHaveBeenCalledWith({
      sectorId: 1,
      descripcion: 'RACK NUEVO',
      activo: true,
    });
    // Y la zona recién creada entra a la toma sin un segundo paso.
    expect(servicio.guardarZona).toHaveBeenCalledWith({
      inventarioId: 5,
      zonaId: 77,
      concluido: false,
    });
  });

  it('si el sector tampoco está, lo crea antes y usa su id', async () => {
    sectores.deSucursal = vi.fn(() => of(SECTORES));
    dialogo.abrir = vi.fn(async () => ({
      accion: 'crear',
      descripcion: 'RACK NUEVO',
      sectorId: null,
      sectorNuevo: 'DEPOSITO FONDO',
    }));

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    expect(sectores.guardar).toHaveBeenCalledWith({
      sucursalId: 3,
      descripcion: 'DEPOSITO FONDO',
      activo: true,
    });
    // El 55 sale del sector recién creado, no del que venía en la lista.
    expect(zonas.guardar).toHaveBeenCalledWith({
      sectorId: 55,
      descripcion: 'RACK NUEVO',
      activo: true,
    });
  });

  it('si falla la zona, no dice que no se pudo hacer nada', async () => {
    // El sector ya quedó creado: negarlo deja al usuario creándolo de nuevo
    // y duplicándolo.
    sectores.deSucursal = vi.fn(() => of(SECTORES));
    zonas.guardar = vi.fn(() => throwError(() => new Error('descripcion duplicada')));
    dialogo.abrir = vi.fn(async () => ({
      accion: 'crear',
      descripcion: 'ESTANTE ALTO',
      sectorId: 1,
    }));

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    expect(notificacion.danger).toHaveBeenCalledWith('descripcion duplicada');
    expect(servicio.guardarZona).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Un menú renderiza en un overlay, fuera del árbol del componente.**
   * Mirar `nativeElement.textContent` daría siempre vacío y el test pasaría
   * sin probar nada — que es peor que no tenerlo. Hay que abrirlo y buscar en
   * el contenedor del overlay.
   */
  describe('Menú de acciones', () => {
    const abrirMenu = (f: ComponentFixture<InventarioDetallePage>) => {
      const disparador = f.nativeElement.querySelector(
        '[aria-label="Más opciones"]',
      ) as HTMLButtonElement;
      disparador.click();
      f.detectChanges();
      return [
        ...document.querySelectorAll('.mat-mdc-menu-content [mat-menu-item], .mat-mdc-menu-content button'),
      ].map((b) => b.textContent?.trim());
    };

    afterEach(() => {
      document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
    });

    /**
     * Regresión: el disparador y el `<mat-menu>` vivían en el mismo `@if`.
     * Con más de un nodo raíz, Angular **no proyecta al slot** —lo avisa con
     * NG8011, que es un warning y no frena el build— y el botón terminaba
     * suelto en el cuerpo de la página, debajo de la barra roja y centrado.
     * Por eso se mira **dónde** está, no si existe.
     */
    it('el disparador va en la barra superior, no en el cuerpo', () => {
      const f = montar();
      const barra = f.nativeElement.querySelector('header.barra') as HTMLElement;

      expect(barra.querySelector('[aria-label="Más opciones"]')).not.toBeNull();
    });

    it('la barra de abajo queda solo con la acción principal', () => {
      // ⚠️ Este assert es exacto a propósito. Con los cuatro botones apilados la
      // barra fija se comía media pantalla y tapaba justo lo que hay que mirar:
      // el conteo. «Agregar zona» tampoco entra: vive al final de la lista, con
      // el mismo trato que un «Cargar más».
      const f = montar();
      const pie = f.nativeElement.querySelector('footer.acciones') as HTMLElement;
      const textos = [...pie.querySelectorAll('button')].map((b) => b.textContent?.trim());

      expect(textos).toEqual(['Finalizar inventario']);
    });

    it('lo secundario sigue siendo alcanzable desde el menú', () => {
      const f = montar();
      const items = abrirMenu(f);

      expect(items).toContain('Revisar');
      expect(items).toContain('Cancelar toma');
      expect(items).toContain('Compartir por QR');
    });

    it('«Agregar zona» no queda duplicada en el menú', () => {
      // La misma acción en dos lugares de una pantalla de teléfono es ruido, y
      // deja dudando cuál de las dos hace algo distinto.
      const f = montar();

      expect(abrirMenu(f)).not.toContain('Agregar zona');
    });

    it('con la toma cerrada el menú no ofrece escribir', () => {
      servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO, [ZONA_ABIERTA])));
      const f = montar();
      const items = abrirMenu(f);

      // Revisar y Compartir sí: leer lo que quedó no caduca al finalizar.
      expect(items).toContain('Revisar');
      expect(items).not.toContain('Agregar zona');
      expect(items).not.toContain('Cancelar toma');
      // Y sin acción principal, la barra de abajo no existe.
      expect(f.nativeElement.querySelector('footer.acciones button')).toBeNull();
    });
  });

  /**
   * ⚠️ **Contar una sucursal con mercadería sin recibir le deja el stock mal
   * al producto**: esa mercadería puede estar en el depósito y todavía no
   * haber entrado al sistema. `frc-mobile` avisa con un toast de seis
   * segundos que se pierde si mirás para otro lado.
   */
  describe('Aviso de transferencias pendientes', () => {
    it('filtra por estado y no por etapa, para no perder las que ya llegaron', () => {
      montar();

      expect(transferencias.conFiltros).toHaveBeenCalledWith(
        expect.objectContaining({
          sucursalDestinoId: 3,
          estados: [TransferenciaEstado.EN_TRANSITO, TransferenciaEstado.EN_DESTINO],
        }),
      );
      // `frc-mobile` filtra `etapa: TRANSPORTE_EN_CAMINO` y con eso no ve las
      // que están en destino esperando recepción, que son las peores.
      const filtros = transferencias.conFiltros.mock.calls[0][0];
      expect(filtros.etapa).toBeUndefined();
    });

    it('muestra el aviso cuando hay alguna', () => {
      transferencias.conFiltros = vi.fn(() => of({ getTotalElements: 3 }));
      const f = montar();
      f.detectChanges();

      expect(f.componentInstance.transferenciasPendientes()).toBe(3);
      expect(f.nativeElement.textContent).toContain('3 transferencias sin recibir');
    });

    it('dice la consecuencia, sin la paradoja de antes', () => {
      transferencias.conFiltros = vi.fn(() => of({ getTotalElements: 3 }));
      const f = montar();
      f.detectChanges();

      const texto = f.nativeElement.textContent as string;
      expect(texto).toContain('Continuar el conteo dejará el stock mal en la sucursal');
      // La frase vieja no se entendía en el mostrador: nombraba el síntoma con
      // una paradoja en vez de decir lo que pasa.
      expect(texto).not.toContain('diferencias que no son diferencias');
    });

    it('en singular no dice 1 transferencias', () => {
      transferencias.conFiltros = vi.fn(() => of({ getTotalElements: 1 }));
      const f = montar();
      f.detectChanges();
      expect(f.nativeElement.textContent).toContain('1 transferencia sin recibir');
    });

    it('sin ninguna no ocupa lugar', () => {
      const f = montar();
      f.detectChanges();
      expect(f.nativeElement.textContent).not.toContain('sin recibir');
    });

    it('con la toma cerrada no pregunta: el conteo ya ocurrió', () => {
      servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO, [ZONA_ABIERTA])));
      montar();
      expect(transferencias.conFiltros).not.toHaveBeenCalled();
    });

    it('si la consulta falla no afirma que no hay ninguna ni rompe la pantalla', () => {
      transferencias.conFiltros = vi.fn(() => throwError(() => new Error('sin conexión')));
      const f = montar();
      f.detectChanges();

      expect(f.componentInstance.transferenciasPendientes()).toBe(0);
      expect(f.nativeElement.textContent).toContain('Zonas');
    });
  });

  it('cerrar el diálogo sin elegir no escribe nada', async () => {
    sectores.deSucursal = vi.fn(() => of(SECTORES));
    dialogo.abrir = vi.fn(async () => undefined);

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    expect(zonas.guardar).not.toHaveBeenCalled();
    expect(servicio.guardarZona).not.toHaveBeenCalled();
  });
});
