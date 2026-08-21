import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ConfirmarRetiroInput, PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { ConfirmarRetiroGQL } from 'src/app/graphql/operaciones/gastos/confirmarRetiro';
import { FilterPreGastosGQL } from 'src/app/graphql/operaciones/gastos/filterPreGastos';
import { PreGastoPorIdGQL } from 'src/app/graphql/operaciones/gastos/preGastoPorId';
import {
  GastoRendicion,
  SaveGastoRendicionGQL,
} from 'src/app/graphql/operaciones/gastos/saveGastoRendicion';

export interface FiltrosPreGasto {
  cajaId?: number;
  estado?: string | null;
  estados?: string[];
  inicio?: string;
  fin?: string;
  page?: number;
  size?: number;
}

/**
 * Caja chica: solicitud → retiro con QR → rendición → devolución de vuelto.
 *
 * ⚠️ **Los estados los presenta el backend.** `estadoEtiqueta`, `estadoColor`
 * y `estadoIcono` vienen calculados; este servicio no los toca. Es el único
 * módulo del repo que hace esto, y es el patrón correcto: un estado nuevo en
 * el central aparece en la UI sin tocar el cliente.
 */
@Injectable({ providedIn: 'root' })
export class GastosService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(PreGastoPorIdGQL);
  private readonly filtrarGQL = inject(FilterPreGastosGQL);
  private readonly retiroGQL = inject(ConfirmarRetiroGQL);
  private readonly rendicionGQL = inject(SaveGastoRendicionGQL);

  /**
   * ⚠️ **Se resuelve por id y sucursal.** Un `PreGasto` sin `sucId` no se
   * encuentra: el id no es único entre filiales.
   */
  porId(id: number, sucId: number): Observable<PreGasto> {
    return this.datos.consultar<PreGasto>(this.porIdGQL, { id, sucId });
  }

  filtrar(filtros: FiltrosPreGasto = {}): Observable<PageInfo<PreGasto>> {
    return this.datos.consultar<PageInfo<PreGasto>>(this.filtrarGQL, {
      id: null,
      cajaId: filtros.cajaId ?? null,
      estado: filtros.estado ?? null,
      estados: filtros.estados ?? null,
      inicio: filtros.inicio ?? null,
      fin: filtros.fin ?? null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 10,
    });
  }

  /**
   * Confirma que el funcionario retiró el efectivo.
   *
   * El `qrToken` **ata el retiro a esa solicitud puntual**: sin él, un retiro
   * podría imputarse a otra. Lo emite el backend con el `PreGasto` y viaja en
   * el QR que el funcionario muestra en la caja.
   */
  confirmarRetiro(input: ConfirmarRetiroInput): Observable<PreGasto> {
    return this.datos.mutar<PreGasto>(this.retiroGQL, { input });
  }

  /**
   * Registra la rendición del gasto.
   *
   * ⚠️ **Las fotos viajan como data URI dentro de la mutation.** No hay
   * endpoint de subida: `frc-mobile` mandaba `image.dataUrl` en el campo
   * llamado `...Urls` y el central lo guarda tal cual. Por eso la pantalla
   * reduce la imagen antes de codificarla — una foto de teléfono sin tocar
   * son varios megabytes de base64 en un solo request.
   */
  rendir(input: Record<string, unknown>): Observable<GastoRendicion> {
    return this.datos.mutar<GastoRendicion>(
      this.rendicionGQL,
      { input },
      { mensajeExito: 'Rendición registrada' },
    );
  }
}
