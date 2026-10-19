import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import {
  TransferenciaEstado,
  type Transferencia,
} from '../domains/transferencia/transferencia.model';
import {
  SIN_FILTROS,
  aVariables,
  coincide,
  filtrosActivos,
} from '../pages/transferencias/filtros-lista';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import { TransferenciasListaPage } from '../pages/transferencias/transferencias-lista.page';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

const SUCURSALES = [
  { id: 999, nombre: 'COMPRAS', deposito: false, activo: true },
  { id: 1, nombre: 'SUC. ROTONDA', deposito: true, activo: true },
  { id: 3, nombre: 'SUC. PALOMA 1', deposito: true, activo: true },
];

const transferencia = (id: number, datos: Partial<Transferencia> = {}): Transferencia =>
  ({
    id,
    estado: TransferenciaEstado.ABIERTA,
    creadoEn: '2026-10-05 09:30',
    sucursalOrigen: { id: 1, nombre: 'SUC. ROTONDA' },
    sucursalDestino: { id: 3, nombre: 'SUC. PALOMA 1' },
    ...datos,
  }) as Transferencia;

describe('Filtros de la lista de transferencias: las reglas', () => {
  it('sin filtros no manda nada que acote', () => {
    expect(aVariables(SIN_FILTROS)).toEqual({
      estado: null,
      creadoDesde: null,
      creadoHasta: null,
      sucursalOrigenId: undefined,
      sucursalDestinoId: undefined,
    });
    expect(filtrosActivos(SIN_FILTROS)).toBe(0);
  });

  /**
   * ⚠️ **El central lee una fecha sola como medianoche** y compara
   * `creadoEn <= hasta`: sin la hora, lo creado el último día queda afuera.
   */
  it('«hasta» viaja con el fin del día; «desde», con la fecha sola', () => {
    const v = aVariables({ ...SIN_FILTROS, desde: '2026-10-01', hasta: '2026-10-05' });

    expect(v.creadoDesde).toBe('2026-10-01');
    expect(v.creadoHasta).toBe('2026-10-05 23:59:59');
  });

  it('el rango de fechas cuenta como un solo filtro', () => {
    expect(filtrosActivos({ ...SIN_FILTROS, desde: '2026-10-01', hasta: '2026-10-05' })).toBe(1);
    expect(filtrosActivos({ ...SIN_FILTROS, hasta: '2026-10-05', estado: 'ABIERTA' })).toBe(2);
  });

  it('el rango incluye sus dos extremos', () => {
    const rango = { ...SIN_FILTROS, desde: '2026-10-01', hasta: '2026-10-05' };

    expect(coincide(transferencia(1, { creadoEn: '2026-10-01 00:00' }), rango)).toBe(true);
    expect(coincide(transferencia(2, { creadoEn: '2026-10-05 23:59' }), rango)).toBe(true);
    expect(coincide(transferencia(3, { creadoEn: '2026-09-30 23:59' }), rango)).toBe(false);
    expect(coincide(transferencia(4, { creadoEn: '2026-10-06 00:00' }), rango)).toBe(false);
  });

  /**
   * El central tampoco devuelve una fila sin fecha cuando se filtra por
   * fecha. La época Unix es cómo llega una fecha nula: con solo «hasta»,
   * 1970 pasaría el filtro.
   */
  it('con filtro de fecha, una transferencia sin fecha no pasa', () => {
    const hasta = { ...SIN_FILTROS, hasta: '2026-10-05' };

    expect(coincide(transferencia(1, { creadoEn: undefined }), hasta)).toBe(false);
    expect(coincide(transferencia(2, { creadoEn: '1970-01-01 00:00' }), hasta)).toBe(false);
    expect(coincide(transferencia(3, { creadoEn: undefined }), SIN_FILTROS)).toBe(true);
  });

  it('compara estado y sucursales, con ids que llegan como texto', () => {
    const t = transferencia(1, {
      sucursalOrigen: { id: '1' },
      sucursalDestino: { id: '3' },
    } as unknown as Partial<Transferencia>);

    expect(coincide(t, { ...SIN_FILTROS, origenId: 1, destinoId: 3 })).toBe(true);
    expect(coincide(t, { ...SIN_FILTROS, origenId: 3 })).toBe(false);
    expect(coincide(t, { ...SIN_FILTROS, destinoId: 1 })).toBe(false);
    expect(coincide(t, { ...SIN_FILTROS, estado: 'ABIERTA' })).toBe(true);
    expect(coincide(t, { ...SIN_FILTROS, estado: 'CANCELADA' })).toBe(false);
  });
});

describe('Filtros de la lista de transferencias: la pantalla', () => {
  let servicio: { conFiltros: ReturnType<typeof vi.fn>; porUsuario: ReturnType<typeof vi.fn> };
  let sucursales: { todas: ReturnType<typeof vi.fn> };

  const montar = (inputs: Record<string, string> = {}): ComponentFixture<TransferenciasListaPage> => {
    const f = TestBed.createComponent(TransferenciasListaPage);
    for (const [nombre, valor] of Object.entries(inputs)) {
      f.componentRef.setInput(nombre, valor);
    }
    f.detectChanges();
    return f;
  };

  const elegir = async (
    f: ComponentFixture<TransferenciasListaPage>,
    etiqueta: string,
  ): Promise<void> => {
    const indice = f.componentInstance.vistas().findIndex((v) => v.etiqueta === etiqueta);
    f.componentInstance.cambiarVista(indice);
    f.detectChanges();
    await f.whenStable();
  };

  /** Los filtros de la última consulta al central. */
  const ultima = () => servicio.conFiltros.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    servicio = {
      conFiltros: vi.fn(() => of({ getContent: [], hasNext: false })),
      porUsuario: vi.fn(() => of([])),
    };
    sucursales = { todas: vi.fn(() => of(SUCURSALES)) };

    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        provideRouter([]),
        { provide: TransferenciaService, useValue: servicio },
        { provide: SucursalService, useValue: sucursales },
        {
          provide: AuthService,
          useValue: { usuario: signal({ id: 41 }), roles: signal(['VER TRANSFERENCIA']) },
        },
      ],
    });
  });

  it('sin filtros la consulta sale sin acotar', async () => {
    const f = montar();
    await elegir(f, 'Todas');

    expect(ultima()).toEqual(
      expect.objectContaining({ estado: null, creadoDesde: null, creadoHasta: null, page: 0 }),
    );
    expect(ultima().sucursalOrigenId).toBeUndefined();
    expect(ultima().sucursalDestinoId).toBeUndefined();
    expect(f.componentInstance.activos()).toBe(0);
  });

  it('cada filtro pide una sola vez, desde la primera página', async () => {
    const f = montar();
    await elegir(f, 'Todas');
    servicio.conFiltros.mockClear();

    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);

    expect(servicio.conFiltros).toHaveBeenCalledTimes(1);
    expect(ultima()).toEqual(expect.objectContaining({ estado: 'EN_TRANSITO', page: 0 }));
  });

  it('manda el rango, el origen y el destino', async () => {
    const f = montar();
    await elegir(f, 'Todas');

    f.componentInstance.cambiarDesde('2026-10-01');
    f.componentInstance.cambiarHasta('2026-10-05');
    f.componentInstance.cambiarOrigen(1);
    f.componentInstance.cambiarDestino(3);

    expect(ultima()).toEqual(
      expect.objectContaining({
        creadoDesde: '2026-10-01',
        creadoHasta: '2026-10-05 23:59:59',
        sucursalOrigenId: 1,
        sucursalDestinoId: 3,
      }),
    );
    expect(f.componentInstance.activos()).toBe(3);
  });

  /** El selector y el campo de fecha avisan también cuando no cambió nada. */
  it('elegir lo que ya estaba no vuelve a consultar', async () => {
    const f = montar();
    await elegir(f, 'Todas');
    servicio.conFiltros.mockClear();

    f.componentInstance.cambiarEstado('todos');
    f.componentInstance.cambiarOrigen('todos');
    f.componentInstance.cambiarDesde(null);

    expect(servicio.conFiltros).not.toHaveBeenCalled();
  });

  /** Un rango invertido devuelve vacío y se lee como «no hay». */
  it('un rango invertido no se manda: gana la fecha que se acaba de tocar', async () => {
    const f = montar();
    await elegir(f, 'Todas');

    f.componentInstance.cambiarHasta('2026-10-05');
    f.componentInstance.cambiarDesde('2026-10-10');
    expect(f.componentInstance.filtros()).toEqual(
      expect.objectContaining({ desde: '2026-10-10', hasta: null }),
    );

    f.componentInstance.cambiarHasta('2026-10-02');
    expect(f.componentInstance.filtros()).toEqual(
      expect.objectContaining({ desde: null, hasta: '2026-10-02' }),
    );
  });

  it('los filtros se conservan al cambiar de pestaña', async () => {
    const f = montar();
    await elegir(f, 'Todas');
    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);

    await elegir(f, 'Salen');

    expect(ultima()).toEqual(expect.objectContaining({ estado: 'EN_TRANSITO', isOrigen: true }));
  });

  it('«Cargar más» manda los mismos filtros', async () => {
    servicio.conFiltros = vi.fn(() => of({ getContent: [transferencia(1)], hasNext: true }));
    const f = montar();
    await elegir(f, 'Todas');
    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);

    f.componentInstance.cargarMas();

    expect(ultima()).toEqual(expect.objectContaining({ estado: 'EN_TRANSITO', page: 1 }));
  });

  it('«Limpiar» vuelve a la consulta sin filtros', async () => {
    const f = montar();
    await elegir(f, 'Todas');
    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);
    f.componentInstance.cambiarOrigen(1);

    f.componentInstance.limpiarFiltros();

    expect(f.componentInstance.activos()).toBe(0);
    expect(ultima()).toEqual(expect.objectContaining({ estado: null }));
    expect(ultima().sucursalOrigenId).toBeUndefined();
  });

  it('con filtros y sin resultados dice que nada coincide, no que no hay', async () => {
    const f = montar();
    await elegir(f, 'Todas');
    f.componentInstance.cambiarEstado(TransferenciaEstado.CANCELADA);
    f.detectChanges();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Ninguna coincide');
    expect(texto).not.toContain('Sin transferencias');
  });

  describe('en «Mías»', () => {
    /**
     * `transferenciasPorUsuario` no acepta filtros: se aplican sobre lo que
     * ya llegó, sin volver al central.
     */
    it('filtra lo que ya llegó, sin volver a consultar', () => {
      servicio.porUsuario = vi.fn(() =>
        of([
          transferencia(7, { estado: TransferenciaEstado.EN_TRANSITO }),
          transferencia(8, { estado: TransferenciaEstado.ABIERTA }),
        ]),
      );
      const f = montar();

      f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);
      f.detectChanges();

      expect(servicio.porUsuario).toHaveBeenCalledTimes(1);
      expect(servicio.conFiltros).not.toHaveBeenCalled();
      expect(f.componentInstance.visibles().map((t) => t.id)).toEqual([7]);
      expect(f.nativeElement.textContent).not.toContain('#8');
    });

    it('si ninguna coincide lo dice, y no que no participa en ninguna', () => {
      servicio.porUsuario = vi.fn(() => of([transferencia(7)]));
      const f = montar();

      f.componentInstance.cambiarEstado(TransferenciaEstado.CANCELADA);
      f.detectChanges();

      const texto = f.nativeElement.textContent;
      expect(texto).toContain('Ninguna coincide');
      expect(texto).not.toContain('No participás en ninguna');
    });

    /**
     * ⚠️ **Con 20 cargadas se filtró un recorte**, no todas las del usuario.
     * Decir solo «ninguna coincide» afirmaría algo que no se preguntó.
     */
    it('al tope del central, aclara que buscó en las últimas 20', () => {
      servicio.porUsuario = vi.fn(() =>
        of(Array.from({ length: 20 }, (_, i) => transferencia(i + 1))),
      );
      const f = montar();

      f.componentInstance.cambiarEstado(TransferenciaEstado.CANCELADA);
      f.detectChanges();

      expect(f.nativeElement.textContent).toContain('Se buscó en tus últimas 20');
    });

    /** Tres tarjetas bajo «Son tus últimas 20» dirían que esas tres son las 20. */
    it('al tope y con coincidencias, la nota dice sobre cuántas se filtró', () => {
      servicio.porUsuario = vi.fn(() =>
        of(
          Array.from({ length: 20 }, (_, i) =>
            transferencia(i + 1, {
              estado: i < 3 ? TransferenciaEstado.EN_TRANSITO : TransferenciaEstado.ABIERTA,
            }),
          ),
        ),
      );
      const f = montar();

      f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);
      f.detectChanges();

      expect(f.componentInstance.visibles().length).toBe(3);
      expect(f.nativeElement.textContent).toContain('Se filtró sobre tus últimas 20');
      expect(f.nativeElement.textContent).not.toContain('Son tus últimas');
    });

    it('sin ninguna propia sigue diciendo que no participa, aunque haya filtros', () => {
      const f = montar();

      f.componentInstance.cambiarEstado(TransferenciaEstado.CANCELADA);
      f.detectChanges();

      expect(f.nativeElement.textContent).toContain('No participás en ninguna');
    });
  });

  describe('la sucursal de la URL', () => {
    it('se precarga en «Destino» y cuenta como filtro puesto', () => {
      const f = montar({ sucursal: '3' });

      expect(f.componentInstance.filtros().destinoId).toBe(3);
      expect(f.componentInstance.activos()).toBe(1);
      expect(ultima()).toEqual(expect.objectContaining({ sucursalDestinoId: 3 }));
      expect(f.componentInstance.acotadaPorUrl()).toBe(true);
    });

    /**
     * ⚠️ **Sacar «Destino» no cambia de pestaña.** Las pestañas dependen de
     * cómo se llegó; el aviso, de lo que sigue puesto.
     */
    it('sacarla quita el aviso y deja la pestaña donde estaba', () => {
      const f = montar({ sucursal: '3' });

      f.componentInstance.cambiarDestino('todos');
      f.detectChanges();

      expect(f.componentInstance.acotadaPorUrl()).toBe(false);
      expect(f.componentInstance.vista().etiqueta).toBe('Todas');
      expect(f.componentInstance.vistas().map((v) => v.etiqueta)).not.toContain('Mías');
      expect(ultima().sucursalDestinoId).toBeUndefined();
    });

    /** Un selector con un valor sin opción se ve en blanco: parece sin filtro. */
    it('si no está entre las sucursales, igual aparece como opción', () => {
      const f = montar({ sucursal: '77' });

      expect(f.componentInstance.opcionesDestino().map((o) => o.texto)).toContain('Sucursal 77');
      expect(f.componentInstance.opcionesOrigen().map((o) => o.texto)).not.toContain('Sucursal 77');
    });
  });

  /**
   * ⚠️ **Acá no va `soloOperables`.** Se filtra lo que ya existe, y hay
   * transferencias con origen `COMPRAS`, que no tiene depósito.
   */
  it('ofrece también las sucursales sin depósito', () => {
    const f = montar();

    expect(f.componentInstance.opcionesOrigen().map((o) => o.texto)).toEqual([
      'Todas',
      'COMPRAS',
      'SUC. ROTONDA',
      'SUC. PALOMA 1',
    ]);
  });

  it('si las sucursales no cargan, apaga esos selectores y el resto sigue', async () => {
    sucursales.todas = vi.fn(() => throwError(() => new Error('Sin conexión')));
    const f = montar();
    await elegir(f, 'Todas');
    f.componentInstance.alternarPanel();
    f.detectChanges();

    expect(f.componentInstance.sinSucursales()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No se pudieron cargar las sucursales');

    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);
    expect(ultima()).toEqual(expect.objectContaining({ estado: 'EN_TRANSITO' }));
  });

  it('el panel arranca plegado y el botón dice cuántos filtros hay', () => {
    const f = montar();
    expect(f.nativeElement.querySelector('#filtros-transferencias')).toBeNull();

    f.componentInstance.cambiarEstado(TransferenciaEstado.EN_TRANSITO);
    f.componentInstance.alternarPanel();
    f.detectChanges();

    expect(f.nativeElement.querySelector('#filtros-transferencias')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('Filtros (1)');
    expect(f.nativeElement.textContent).toContain('Limpiar');
  });
});
