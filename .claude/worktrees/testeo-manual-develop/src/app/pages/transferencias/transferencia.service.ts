import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  EtapaTransferencia,
  Transferencia,
  TransferenciaItem,
} from 'src/app/domains/transferencia/transferencia.model';
import { AvanzarEtapaGQL } from 'src/app/graphql/transferencias/avanzarEtapa';
import { FinalizarTransferenciaGQL } from 'src/app/graphql/transferencias/finalizarTransferencia';
import { ItemsPorTransferenciaGQL } from 'src/app/graphql/transferencias/itemsPorTransferencia';
import { TransferenciaPorIdGQL } from 'src/app/graphql/transferencias/transferenciaPorId';
import { TransferenciasConFiltrosGQL } from 'src/app/graphql/transferencias/transferenciasConFiltros';

export interface FiltrosTransferencia {
  sucursalOrigenId?: number;
  sucursalDestinoId?: number;
  estado?: string | null;
  /**
   * Varios estados a la vez.
   *
   * ⚠️ **Estado y etapa son dimensiones distintas**, y para «viene en camino
   * a esta sucursal» hace falta el estado: una transferencia en tránsito
   * puede estar en la etapa `TRANSPORTE_EN_CAMINO` o en
   * `TRANSPORTE_EN_DESTINO`, así que filtrar por una sola etapa deja afuera
   * justo las que ya llegaron y esperan recepción. `frc-mobile` filtra por
   * `TRANSPORTE_EN_CAMINO` y no las ve.
   */
  estados?: string[] | null;
  tipo?: string | null;
  /** ⚠️ **Etapa, no estado.** Son dimensiones distintas. */
  etapa?: EtapaTransferencia | null;
  isOrigen?: boolean | null;
  isDestino?: boolean | null;
  page?: number;
  size?: number;
}

/**
 * Movimiento de mercadería entre sucursales.
 *
 * ⚠️ **La transferencia no crea movimientos de stock.** Son consecuencia del
 * avance de etapa en el backend: salida en origen, entrada en destino.
 */
@Injectable({ providedIn: 'root' })
export class TransferenciaService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(TransferenciaPorIdGQL);
  private readonly filtrosGQL = inject(TransferenciasConFiltrosGQL);
  private readonly itemsGQL = inject(ItemsPorTransferenciaGQL);
  private readonly avanzarGQL = inject(AvanzarEtapaGQL);
  private readonly finalizarGQL = inject(FinalizarTransferenciaGQL);

  porId(id: number): Observable<Transferencia> {
    return this.datos.porId<Transferencia>(this.porIdGQL, id);
  }

  conFiltros(filtros: FiltrosTransferencia = {}): Observable<PageInfo<Transferencia>> {
    return this.datos.consultar<PageInfo<Transferencia>>(this.filtrosGQL, {
      sucursalOrigenId: filtros.sucursalOrigenId ?? null,
      sucursalDestinoId: filtros.sucursalDestinoId ?? null,
      estado: filtros.estado ?? null,
      estados: filtros.estados?.length ? filtros.estados : null,
      tipo: filtros.tipo ?? null,
      etapa: filtros.etapa ?? null,
      isOrigen: filtros.isOrigen ?? null,
      isDestino: filtros.isDestino ?? null,
      creadoDesde: null,
      creadoHasta: null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 10,
    });
  }

  /**
   * ⚠️ **El central devuelve una página, no una lista.** Los ítems vienen en
   * `getContent`; se desenvuelve acá para que las páginas sigan recibiendo un
   * `TransferenciaItem[]` plano.
   *
   * ⚠️ **`producto` no existe en `TransferenciaItem` del central**: cuelga de
   * la presentación. Se copia al ítem para no tocar la vista.
   */
  items(id: number, page = 0, size = 50): Observable<TransferenciaItem[]> {
    return this.datos
      .consultar<{ getContent?: TransferenciaItem[] }>(this.itemsGQL, { id, page, size })
      .pipe(
        map((pagina) =>
          (pagina?.getContent ?? []).map((item) => ({
            // clonar: Apollo congela los resultados y la vista lee `item.producto`
            ...item,
            producto: item.producto ?? item.presentacionPreTransferencia?.producto,
          })),
        ),
      );
  }

  /**
   * Avanza el workflow.
   *
   * ⚠️ **Es el único camino correcto.** Guardar la transferencia con la etapa
   * cambiada saltea las validaciones y los movimientos de stock que el
   * backend aplica en el avance.
   */
  avanzarEtapa(id: number, etapa: EtapaTransferencia, usuarioId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.avanzarGQL, { id, etapa, usuarioId });
  }

  finalizar(id: number, usuarioId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.finalizarGQL, { id, usuarioId });
  }
}
