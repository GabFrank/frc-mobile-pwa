import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService, type OpcionesOperacion } from 'src/app/core/graphql/datos.service';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type {
  FuenteVerdadVencimiento,
  ProductoVencido,
} from 'src/app/domains/productos/producto-vencido.model';
import { ProductosVencidosGQL } from 'src/app/graphql/productos/productosVencidos';

/** Filas por página. Entra una pantalla y media en un teléfono. */
export const TAMANO_PAGINA_VENCIDOS = 15;

export interface FiltrosVencidos {
  /** `yyyy-MM-dd`. Acota por fecha de vencimiento, no de carga. */
  desde?: string | null;
  hasta?: string | null;
  sucursalIds?: number[] | null;
  productoIds?: number[] | null;
  fuentes?: FuenteVerdadVencimiento[] | null;
  /** Deja solo lo que ya pasó su fecha, sin lo que está por vencer. */
  soloVencidos?: boolean;
  page?: number;
  size?: number;
}

/**
 * Reporte de vencimientos.
 *
 * Contesta la pregunta operativa de la mañana: qué hay que sacar de la
 * góndola hoy. El cálculo de días y su clasificación los hace el central;
 * este servicio transporta.
 */
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly datos = inject(DatosService);
  private readonly vencidosGQL = inject(ProductosVencidosGQL);

  /**
   * `opciones` existe para el uso **secundario** de esta consulta: el
   * inventario la usa para sugerir un vencimiento al contar, y ahí un toast
   * de error o la barra de carga global estorbarían — la pantalla sirve
   * igual sin la sugerencia.
   */
  vencidos(
    filtros: FiltrosVencidos = {},
    opciones?: OpcionesOperacion,
  ): Observable<PageInfo<ProductoVencido>> {
    return this.datos.consultar<PageInfo<ProductoVencido>>(
      this.vencidosGQL,
      {
        // Todo explícito en `null`: el central distingue «sin filtro» de una
        // lista vacía, que no devolvería nada.
        startDate: filtros.desde ?? null,
        endDate: filtros.hasta ?? null,
        sucursalIdList: filtros.sucursalIds?.length ? filtros.sucursalIds : null,
        productoIdList: filtros.productoIds?.length ? filtros.productoIds : null,
        fuenteVerdadList: filtros.fuentes?.length ? filtros.fuentes : null,
        soloRealmenteVencidos: filtros.soloVencidos ?? false,
        page: filtros.page ?? 0,
        size: filtros.size ?? TAMANO_PAGINA_VENCIDOS,
      },
      opciones,
    );
  }
}
