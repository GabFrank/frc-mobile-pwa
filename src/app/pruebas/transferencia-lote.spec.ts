import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { print } from 'graphql';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogoService } from '../core/ui/dialogo.service';
import { EstadoLote, type StockLotePresentacion } from '../domains/lote/lote.model';
import { LoteService } from '../domains/lote/lote.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { stockPorLoteEnPresentacionQuery } from '../graphql/lote/graphql-query';
import { itemsPorTransferenciaQuery } from '../graphql/transferencias/graphql-query';
import type { DatosSeleccionarLote } from '../pages/transferencias/seleccionar-lote-dialog.component';
import { SeleccionarLoteDialogComponent } from '../pages/transferencias/seleccionar-lote-dialog.component';
import type { TransferenciaItemData } from '../pages/transferencias/transferencia-item-dialog.component';
import { TransferenciaItemDialogComponent } from '../pages/transferencias/transferencia-item-dialog.component';

const pagina = (filas: StockLotePresentacion[], hasNext = false) => ({
  getContent: filas,
  getTotalElements: filas.length,
  hasNext,
});

const LIBERADO: StockLotePresentacion = {
  loteId: 707,
  numeroLote: 'L-2026-88',
  // Como lo manda el central: `yyyy-MM-dd HH:mm`, aunque sea un día y no un instante.
  fechaVencimiento: '2026-12-12 00:00',
  estado: EstadoLote.LIBERADO,
  cantidadDisponible: 20,
  cantidadDisponiblePresentacion: 3,
  unidadesSobrantes: 2,
  unidadesPorPresentacion: 6,
  presentacionDescripcion: 'CAJA',
};

const BLOQUEADO: StockLotePresentacion = {
  loteId: 808,
  numeroLote: 'L-2025-01',
  estado: EstadoLote.BLOQUEADO,
  cantidadDisponible: 60,
  cantidadDisponiblePresentacion: 10,
  unidadesSobrantes: 0,
  unidadesPorPresentacion: 6,
};

describe('Elegir el lote de un ítem de transferencia', () => {
  let cerrar: ReturnType<typeof vi.fn>;
  let lotes: { stockEnPresentacion: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const DATOS: DatosSeleccionarLote = {
    productoId: 7,
    productoDescripcion: '7 - GALLETITA',
    sucursalOrigenId: 1,
    sucursalOrigenNombre: 'SUC. ROTONDA',
    presentacionId: 88,
  };

  beforeEach(() => {
    cerrar = vi.fn();
    lotes = { stockEnPresentacion: vi.fn(() => of(pagina([LIBERADO, BLOQUEADO]))) };
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close: cerrar } },
        { provide: LoteService, useValue: lotes },
      ],
    });
  });

  const montar = (datos: Partial<DatosSeleccionarLote> = {}) => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { ...DATOS, ...datos } });
    const f = TestBed.createComponent(SeleccionarLoteDialogComponent);
    f.detectChanges();
    return f;
  };

  it('pide el saldo de la sucursal de origen y en la presentación del renglón', () => {
    montar();
    expect(lotes.stockEnPresentacion).toHaveBeenCalledWith(7, 1, 88, '', 0, 10);
  });

  /**
   * ⚠️ **El saldo se muestra como lo devuelve el central**, en presentaciones
   * completas. Dividirlo acá sería tener la regla en dos lados, y es la forma
   * de que el número que ve el operador y el que descuenta el central dejen
   * de coincidir.
   */
  it('muestra el saldo en presentaciones, sin convertir nada', () => {
    const f = montar();
    expect(f.componentInstance.enPresentacion(LIBERADO)).toBe('3');
  });

  /**
   * ⚠️ **Las unidades sueltas existen aunque no salgan en esta presentación.**
   * Un lote de 20 unidades en cajas de 6 da 3 cajas: sin decir que sobran 2,
   * el operador cree que se le perdió stock.
   */
  it('avisa cuántas unidades quedan fuera de las presentaciones completas', () => {
    const f = montar();
    expect(f.componentInstance.sobrantes(LIBERADO)).toContain('sobran 2');
  });

  it('con presentación unidad no repite el saldo en unidades', () => {
    const f = montar();
    expect(f.componentInstance.sobrantes({ ...LIBERADO, unidadesPorPresentacion: 1 })).toBe('');
  });

  /**
   * ⚠️ **Bloquear un lote es el mecanismo de recall.** Se lista igual, porque
   * esconderlo deja al operador buscando el que tiene en la mano sin ninguna
   * explicación; lo que no se puede es elegirlo.
   */
  it('lista los lotes que no están liberados, pero no deja elegirlos', () => {
    const f = montar();

    expect(texto(f)).toContain('L-2025-01');
    expect(f.componentInstance.esElegible(BLOQUEADO)).toBe(false);

    f.componentInstance.elegir(BLOQUEADO);
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('elegir un lote liberado lo devuelve con su saldo', () => {
    const f = montar();
    f.componentInstance.elegir(LIBERADO);

    expect(cerrar).toHaveBeenCalledWith({
      loteId: 707,
      numeroLote: 'L-2026-88',
      cantidadDisponible: 20,
      cantidadDisponiblePresentacion: 3,
      fechaVencimiento: '2026-12-12',
    });
  });

  /**
   * ⚠️ El central serializa todo `Date` como `yyyy-MM-dd HH:mm`. Ese texto
   * vuelve tal cual al central si nadie toca el campo, y en pantalla se lee
   * «12/12/2026 00:00», una hora que no significa nada.
   */
  it('recorta la hora que el central le agrega a un vencimiento', () => {
    const f = montar();
    f.componentInstance.elegir(LIBERADO);
    expect(cerrar.mock.calls[0][0].fechaVencimiento).toBe('2026-12-12');
  });

  /**
   * ⚠️ **`null` y `undefined` no son lo mismo acá.** `null` es «sacale el
   * lote», que llega al central como lista vacía y devuelve el ítem a FEFO;
   * `undefined` es cancelar y no toca nada.
   */
  it('salir sin lote devuelve null, y cancelar devuelve undefined', () => {
    const f = montar();
    f.componentInstance.sinLote();
    expect(cerrar).toHaveBeenCalledWith(null);

    cerrar.mockClear();
    f.componentInstance.cerrar();
    expect(cerrar).toHaveBeenCalledWith(undefined);
  });

  it('con un lote ya asignado el botón ofrece sacarlo', () => {
    const f = montar({ loteElegidoId: 707 });
    expect(texto(f)).toContain('Sacar el lote');
  });

  /**
   * ⚠️ **«Este producto no tiene lotes» y «la búsqueda no encontró nada» son
   * respuestas distintas**: la segunda se resuelve borrando el filtro.
   */
  it('distingue el producto sin lotes de la búsqueda sin resultados', async () => {
    lotes.stockEnPresentacion = vi.fn(() => of(pagina([])));
    const f = montar();
    expect(texto(f)).toContain('resuelve el desglose por FEFO');

    f.componentInstance.texto.set('zzz');
    f.componentInstance.buscar();
    f.detectChanges();
    expect(texto(f)).toContain('coincide con lo buscado');
  });

  it('si el central no responde lo dice y deja reintentar', () => {
    lotes.stockEnPresentacion = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    expect(texto(f)).toContain('sin conexión');
  });

  it('traer más lotes acumula en vez de reemplazar la lista', () => {
    lotes.stockEnPresentacion = vi
      .fn()
      .mockReturnValueOnce(of(pagina([LIBERADO], true)))
      .mockReturnValueOnce(of(pagina([BLOQUEADO])));

    const f = montar();
    expect(f.componentInstance.hayMas()).toBe(true);

    f.componentInstance.traerMas();
    expect(f.componentInstance.lotes().length).toBe(2);
    expect(f.componentInstance.hayMas()).toBe(false);
  });
});

describe('Carga de un ítem con lote', () => {
  let cerrar: ReturnType<typeof vi.fn>;
  let dialogo: { abrir: ReturnType<typeof vi.fn> };
  let busqueda: { stock: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const ELEGIDO = {
    loteId: 707,
    numeroLote: 'L-2026-88',
    cantidadDisponible: 20,
    cantidadDisponiblePresentacion: 3,
    fechaVencimiento: '2026-12-12',
  };

  const DATOS: TransferenciaItemData = {
    producto: { id: 7, descripcion: 'GALLETITA', lote: true },
    presentacion: { id: 88, cantidad: 6 } as never,
    sucursalOrigenId: 1,
    sucursalOrigenNombre: 'SUC. ROTONDA',
  };

  beforeEach(() => {
    cerrar = vi.fn();
    dialogo = { abrir: vi.fn(async () => ELEGIDO) };
    busqueda = { stock: vi.fn(() => of(600)) };

    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close: cerrar } },
        { provide: DialogoService, useValue: dialogo },
        { provide: ProductoBusquedaService, useValue: busqueda },
      ],
    });
  });

  const montar = (datos: Partial<TransferenciaItemData> = {}) => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { ...DATOS, ...datos } });
    const f = TestBed.createComponent(TransferenciaItemDialogComponent);
    f.detectChanges();
    return f;
  };

  /**
   * ⚠️ **Lo decide `producto.lote`, no que existan filas en el ledger.** Un
   * producto sin control de lote puede tener alguna por una carga vieja, y
   * ofrecer elegir ahí sugeriría una trazabilidad que el negocio no lleva.
   */
  it('el lote aparece si el producto lo lleva', () => {
    expect(texto(montar())).toContain('Elegir lote');
  });

  it('no aparece si el producto no lleva control de lote', () => {
    const f = montar({ producto: { id: 7, descripcion: 'AZÚCAR', lote: false } });
    expect(texto(f)).not.toContain('Elegir lote');
  });

  it('dice que elegirlo es opcional y qué pasa si no se elige', () => {
    expect(texto(montar())).toContain('Sin elegir, se manda lo que vence antes');
  });

  it('elegido un lote, lo muestra con su vencimiento y su saldo', async () => {
    const f = montar();
    await f.componentInstance.elegirLote();
    f.detectChanges();

    expect(texto(f)).toContain('L-2026-88');
    expect(texto(f)).toContain('12/12/2026');
    expect(texto(f)).toContain('3 disponible');
  });

  /**
   * ⚠️ **El saldo de la sucursal suma todos los lotes.** Comparar contra él
   * diría que hay mercadería de sobra mientras el lote del que se va a sacar
   * está casi vacío, que es justo el caso que elegir a mano viene a resolver.
   */
  it('con lote elegido el aviso de stock compara contra el saldo del lote', async () => {
    const f = montar();
    f.componentInstance.cantidad.set(2);
    expect(f.componentInstance.excede()).toBe(false); // 2 × 6 = 12 ≤ 600 en la sucursal

    await f.componentInstance.elegirLote();
    f.detectChanges();

    // 2 × 6 = 12 unidades contra las 20 del lote: todavía alcanza.
    expect(f.componentInstance.excede()).toBe(false);
    f.componentInstance.cantidad.set(4); // 24 unidades: el lote no da
    expect(f.componentInstance.excede()).toBe(true);
    f.detectChanges();
    expect(texto(f)).toContain('El lote L-2026-88 tiene 20 unidades');
  });

  /**
   * ⚠️ **Sin saldo conocido no se afirma nada.** Al reabrir un ítem ya
   * cargado, la asignación guardada trae el número de lote pero no cuánto
   * queda: decir cero ahí sería afirmar que el lote está vacío.
   */
  it('un lote sin saldo consultado no muestra un aviso de stock', () => {
    const f = montar({
      draft: {
        cantidad: 2,
        vencimiento: null,
        observacion: '',
        lote: { loteId: 707, numeroLote: 'L-2026-88' },
      },
    });

    expect(f.componentInstance.disponible()).toBeNull();
    expect(f.componentInstance.excede()).toBe(false);
    expect(texto(f)).not.toContain('tiene 0 unidades');
    expect(texto(f)).toContain('L-2026-88');
  });

  it('sugiere el vencimiento del lote cuando el campo está vacío', async () => {
    const f = montar();
    await f.componentInstance.elegirLote();

    expect(f.componentInstance.vencimiento()).toBe('2026-12-12');
  });

  /**
   * ⚠️ **El papel que el operador tiene en la mano gana sobre el maestro.**
   * Pisar lo que ya escribió sería corregirle un dato que él verificó contra
   * el envase.
   */
  it('no pisa el vencimiento que el operador ya cargó', async () => {
    const f = montar();
    f.componentInstance.vencimiento.set('2027-01-05');
    await f.componentInstance.elegirLote();

    expect(f.componentInstance.vencimiento()).toBe('2027-01-05');
  });

  it('cancelar el selector deja el lote como estaba', async () => {
    dialogo.abrir = vi.fn(async () => undefined);
    const f = montar();
    await f.componentInstance.elegirLote();

    expect(f.componentInstance.lote()).toBeNull();
  });

  it('sacar el lote lo deja en null, que es lo que después borra la asignación', async () => {
    const f = montar();
    await f.componentInstance.elegirLote();
    expect(f.componentInstance.lote()).not.toBeNull();

    dialogo.abrir = vi.fn(async () => null);
    await f.componentInstance.elegirLote();
    expect(f.componentInstance.lote()).toBeNull();
  });

  it('el renglón guardado lleva el lote elegido', async () => {
    const f = montar();
    f.componentInstance.cantidad.set(2);
    await f.componentInstance.elegirLote();
    f.componentInstance.guardar();

    expect(cerrar).toHaveBeenCalledWith({
      cantidad: 2,
      vencimiento: '2026-12-12',
      observacion: '',
      lote: ELEGIDO,
    });
  });

  it('le pasa al selector el producto, la sucursal de origen y la presentación', async () => {
    const f = montar();
    await f.componentInstance.elegirLote();

    expect(dialogo.abrir.mock.calls[0][1]).toMatchObject({
      productoId: 7,
      sucursalOrigenId: 1,
      sucursalOrigenNombre: 'SUC. ROTONDA',
      presentacionId: 88,
    });
  });
});

describe('Operaciones GraphQL de los lotes de una transferencia', () => {
  it('el saldo por lote aliasea la raíz a data', () => {
    expect(print(stockPorLoteEnPresentacionQuery)).toContain(
      'data: stockPorLoteEnPresentacion(',
    );
  });

  /**
   * ⚠️ Sin estos campos la pantalla tendría que dividir por su cuenta, que es
   * la regla que se dejó en el central a propósito.
   */
  it('pide el saldo ya convertido y las unidades sobrantes', () => {
    const documento = print(stockPorLoteEnPresentacionQuery);
    expect(documento).toContain('cantidadDisponiblePresentacion');
    expect(documento).toContain('unidadesSobrantes');
    expect(documento).toContain('unidadesPorPresentacion');
  });

  it('trae la asignación de lotes de cada ítem', () => {
    const documento = print(itemsPorTransferenciaQuery);
    expect(documento).toContain('lotesAsignados');
    expect(documento).toContain('cantidadPresentacion');
    expect(documento).toContain('etapa');
  });

  /**
   * ⚠️ Sin `lote` en el producto, al reabrir un renglón la pantalla no sabe
   * si corresponde ofrecer el selector: el flag no se puede deducir de que
   * haya o no una asignación.
   */
  it('trae el flag de control de lote del producto', () => {
    expect(print(itemsPorTransferenciaQuery)).toContain('lote');
  });
});
