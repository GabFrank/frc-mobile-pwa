import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ActualizarFechasLoteGQL } from 'src/app/graphql/lote/actualizarFechasLote';
import { BuscarLotesDeProductoGQL } from 'src/app/graphql/lote/buscarLotesDeProducto';
import { CrearLoteGQL } from 'src/app/graphql/lote/crearLote';
import { StockPorLoteGQL } from 'src/app/graphql/lote/stockPorLote';
import { StockPorLoteEnPresentacionGQL } from 'src/app/graphql/lote/stockPorLoteEnPresentacion';
import type {
  CrearLoteInput,
  FechasLoteInput,
  Lote,
  LoteDeProducto,
  StockLote,
  StockLotePresentacion,
} from './lote.model';
import type { PageInfo } from 'src/app/domains/page-info.model';

/**
 * Control de lotes.
 *
 * ⚠️ **Acá no se decide nada de negocio.** El saldo por lote, el orden FEFO, la
 * normalización del número y qué fecha queda al corregir un lote los resuelve
 * el central. Este servicio transporta.
 */
@Injectable({ providedIn: 'root' })
export class LoteService {
  private readonly datos = inject(DatosService);
  private readonly stockGQL = inject(StockPorLoteGQL);
  private readonly buscarGQL = inject(BuscarLotesDeProductoGQL);
  private readonly fechasGQL = inject(ActualizarFechasLoteGQL);
  private readonly crearGQL = inject(CrearLoteGQL);
  private readonly stockPresentacionGQL = inject(StockPorLoteEnPresentacionGQL);

  /**
   * Saldo por lote de un producto en una sucursal, en **unidades base**.
   *
   * ⚠️ **Descarta la fila «SIN LOTE»**, que llega con `loteId` nulo. Es el
   * stock que existe sin estar atribuido a ningún lote: sirve como diagnóstico,
   * pero no es un lote que se pueda contar. Dejarla pasar haría aparecer un
   * renglón de conteo contra un lote que no existe.
   */
  stockPorLote(productoId: number, sucursalId: number): Observable<StockLote[]> {
    return this.datos
      .consultar<StockLote[]>(this.stockGQL, { productoId, sucursalId })
      .pipe(map((filas) => (filas ?? []).filter((f) => f.loteId != null)));
  }

  /**
   * Buscador paginado de lotes de un producto.
   *
   * Incluye los de saldo cero a propósito: son los que hacen falta para
   * atribuir mercadería que está en la góndola sin lote asignado.
   */
  buscar(
    productoId: number,
    sucursalId: number | undefined,
    texto: string | undefined,
    page = 0,
    size = 10,
  ): Observable<PageInfo<LoteDeProducto>> {
    return this.datos.consultar<PageInfo<LoteDeProducto>>(this.buscarGQL, {
      productoId,
      sucursalId,
      texto: texto?.trim() || null,
      page,
      size,
    });
  }

  /**
   * Saldo por lote **ya convertido a la presentación** con la que se está
   * cargando el renglón, paginado y ordenado por FEFO.
   *
   * ⚠️ **Es la consulta que hay que usar cuando el operador carga en cajas.**
   * `stockPorLote` devuelve unidades y obliga a dividir en la pantalla; acá la
   * conversión la hace el central, que es el mismo que después reparte el
   * stock contra el lote elegido. Dos implementaciones de esa división es
   * exactamente lo que hace que el saldo mostrado y el descontado no coincidan.
   *
   * ⚠️ **Descarta la fila «SIN LOTE»** (`loteId` nulo), igual que
   * [`stockPorLote`](#stockPorLote): es stock sin atribuir, no un lote que se
   * pueda elegir.
   */
  stockEnPresentacion(
    productoId: number,
    sucursalId: number,
    presentacionId: number | undefined,
    texto: string | undefined,
    page = 0,
    size = 10,
  ): Observable<PageInfo<StockLotePresentacion>> {
    return this.datos
      .consultar<PageInfo<StockLotePresentacion>>(this.stockPresentacionGQL, {
        productoId,
        sucursalId,
        presentacionId: presentacionId ?? null,
        numeroLote: texto?.trim() || null,
        page,
        size,
      })
      .pipe(
        map((pagina) => ({
          ...pagina,
          getContent: (pagina?.getContent ?? []).filter((f) => f.loteId != null),
        })),
      );
  }

  /**
   * Carga o corrige las fechas del maestro.
   *
   * ⚠️ **Es global**: afecta el FEFO del lote en todas las sucursales. Quien
   * llame tiene que haberlo advertido en pantalla.
   */
  actualizarFechas(input: FechasLoteInput): Observable<Lote> {
    return this.datos.mutar<Lote>(this.fechasGQL, {
      ...input,
      fechaVencimiento: input.fechaVencimiento || null,
      fechaRetiro: input.fechaRetiro || null,
    });
  }

  /**
   * Alta manual de un lote, **sin mover stock**.
   *
   * ⚠️ Nace con saldo cero: registrar el lote es decir que existe, no decir
   * cuánto hay. La existencia se la pone el conteo al finalizar.
   */
  crear(input: CrearLoteInput): Observable<Lote> {
    return this.datos.mutar<Lote>(this.crearGQL, {
      ...input,
      fechaVencimiento: input.fechaVencimiento || null,
      fechaRetiro: input.fechaRetiro || null,
    });
  }
}
