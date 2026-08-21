import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  Devolucion,
  DevolucionInput,
  DevolucionItem,
  DevolucionItemInput,
  MotivoAveria,
} from 'src/app/domains/devolucion/devolucion.model';
import { EstadoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { AvanzarEstadoDevolucionGQL } from 'src/app/graphql/operaciones/devolucion/avanzarEstadoDevolucion';
import { DeleteDevolucionItemGQL } from 'src/app/graphql/operaciones/devolucion/deleteDevolucionItem';
import { DevolucionByIdGQL } from 'src/app/graphql/operaciones/devolucion/devolucionById';
import { DevolucionConFiltrosGQL } from 'src/app/graphql/operaciones/devolucion/devolucionConFiltros';
import { EtiquetasSeparadoPdfGQL } from 'src/app/graphql/operaciones/devolucion/etiquetasSeparadoPdf';
import { MotivosAveriaActivosGQL } from 'src/app/graphql/operaciones/devolucion/motivosAveriaActivos';
import { RevertirEstadoDevolucionGQL } from 'src/app/graphql/operaciones/devolucion/revertirEstadoDevolucion';
import { SaveDevolucionGQL } from 'src/app/graphql/operaciones/devolucion/saveDevolucion';
import { SaveDevolucionItemGQL } from 'src/app/graphql/operaciones/devolucion/saveDevolucionItem';

export interface FiltrosDevolucion {
  proveedorId?: number;
  sucursalId?: number;
  estado?: EstadoDevolucion | null;
  usuarioId?: number;
  page?: number;
  size?: number;
}

/**
 * Devolución de productos averiados o vencidos.
 *
 * El circuito va de la góndola a la salida de la empresa y atraviesa tres
 * actores: quien detecta y separa en la sucursal, quien colecta hacia el
 * depósito, y quien retira para entregar al proveedor.
 *
 * ⚠️ **La máquina de estados la valida el backend.** Este servicio llama
 * `avanzarEstado` y devuelve lo que conteste; no decide qué transición es
 * legal. Replicar las reglas acá garantiza que en algún momento difieran de
 * las del central. Ver `docs/modulos/operaciones-devolucion.md`.
 */
@Injectable({ providedIn: 'root' })
export class DevolucionService {
  private readonly datos = inject(DatosService);
  private readonly guardarGQL = inject(SaveDevolucionGQL);
  private readonly guardarItemGQL = inject(SaveDevolucionItemGQL);
  private readonly borrarItemGQL = inject(DeleteDevolucionItemGQL);
  private readonly porIdGQL = inject(DevolucionByIdGQL);
  private readonly conFiltrosGQL = inject(DevolucionConFiltrosGQL);
  private readonly motivosGQL = inject(MotivosAveriaActivosGQL);
  private readonly avanzarGQL = inject(AvanzarEstadoDevolucionGQL);
  private readonly revertirGQL = inject(RevertirEstadoDevolucionGQL);
  private readonly etiquetasGQL = inject(EtiquetasSeparadoPdfGQL);

  /**
   * Alta o edición de la cabecera **con sus ítems**.
   *
   * `DevolucionInput.items` viaja completo: el backend arma la devolución
   * entera en una operación. `saveDevolucionItem` es para editar un ítem de
   * una devolución que ya existe, no para cargarla.
   */
  guardar(input: DevolucionInput): Observable<Devolucion> {
    return this.datos.mutar<Devolucion>(this.guardarGQL, { entity: input });
  }

  guardarItem(input: DevolucionItemInput): Observable<DevolucionItem> {
    return this.datos.mutar<DevolucionItem>(this.guardarItemGQL, { entity: input });
  }

  borrarItem(id: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.borrarItemGQL, { id });
  }

  porId(id: number): Observable<Devolucion> {
    return this.datos.porId<Devolucion>(this.porIdGQL, id);
  }

  conFiltros(filtros: FiltrosDevolucion): Observable<PageInfo<Devolucion>> {
    return this.datos.consultar<PageInfo<Devolucion>>(this.conFiltrosGQL, {
      proveedorId: filtros.proveedorId ?? null,
      sucursalId: filtros.sucursalId ?? null,
      estado: filtros.estado ?? null,
      usuarioId: filtros.usuarioId ?? null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 10,
    });
  }

  /**
   * Motivos de avería vigentes.
   *
   * ⚠️ **No hardcodear la lista.** Cada motivo trae `generaGasto` y
   * `aplicaProveedor`, que deciden el destino económico de la devolución.
   */
  motivos(): Observable<MotivoAveria[]> {
    return this.datos
      .consultar<MotivoAveria[]>(this.motivosGQL)
      .pipe(map((lista) => lista ?? []));
  }

  avanzarEstado(
    devolucionId: number,
    estado: EstadoDevolucion,
    usuarioId: number,
  ): Observable<Devolucion> {
    return this.datos.mutar<Devolucion>(this.avanzarGQL, { devolucionId, estado, usuarioId });
  }

  revertirEstado(devolucionId: number, usuarioId: number): Observable<Devolucion> {
    return this.datos.mutar<Devolucion>(this.revertirGQL, { devolucionId, usuarioId });
  }

  /** Etiquetas de separado en base64, para abrir con `PdfService`. */
  etiquetas(devolucionId: number): Observable<string> {
    return this.datos.consultar<string>(this.etiquetasGQL, { devolucionId });
  }
}
