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
import {
  DevolucionConfiguracionRetiro,
  RetiroBloqueResultado,
  RetiroProveedorConsolidado,
} from 'src/app/domains/devolucion/retiro.model';
import { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { AvanzarEstadoDevolucionGQL } from 'src/app/graphql/operaciones/devolucion/avanzarEstadoDevolucion';
import { DeleteDevolucionItemGQL } from 'src/app/graphql/operaciones/devolucion/deleteDevolucionItem';
import { DevolucionByIdGQL } from 'src/app/graphql/operaciones/devolucion/devolucionById';
import { DevolucionConFiltrosGQL } from 'src/app/graphql/operaciones/devolucion/devolucionConFiltros';
import { DevolucionConfiguracionRetiroGQL } from 'src/app/graphql/operaciones/devolucion/devolucionConfiguracionRetiro';
import { EtiquetasSeparadoPdfGQL } from 'src/app/graphql/operaciones/devolucion/etiquetasSeparadoPdf';
import { MotivosAveriaActivosGQL } from 'src/app/graphql/operaciones/devolucion/motivosAveriaActivos';
import { ProveedoresPorTextoGQL } from 'src/app/graphql/personas/proveedor/proveedoresPorTexto';
import { RemitoRetiroProveedorGQL } from 'src/app/graphql/operaciones/devolucion/remitoRetiroProveedor';
import { RetirarDevolucionesEnBloqueGQL } from 'src/app/graphql/operaciones/devolucion/retirarDevolucionesEnBloque';
import { RetiroProveedorConsolidadoGQL } from 'src/app/graphql/operaciones/devolucion/retiroProveedorConsolidado';
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
  private readonly proveedoresGQL = inject(ProveedoresPorTextoGQL);
  private readonly consolidadoGQL = inject(RetiroProveedorConsolidadoGQL);
  private readonly retirarGQL = inject(RetirarDevolucionesEnBloqueGQL);
  private readonly comprobanteGQL = inject(RemitoRetiroProveedorGQL);
  private readonly configuracionGQL = inject(DevolucionConfiguracionRetiroGQL);

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
   * Proveedores por nombre, para elegir a quién se le devuelve.
   *
   * El texto viaja en mayúsculas: así están guardados los nombres.
   */
  proveedores(texto: string, page = 0, size = 10): Observable<PageInfo<Proveedor>> {
    return this.datos.consultar<PageInfo<Proveedor>>(this.proveedoresGQL, {
      texto: (texto ?? '').toUpperCase(),
      page,
      size,
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

  /**
   * Etiqueta de separado en base64, para abrir con `PdfService`. Es **una
   * sola por devolución**: un QR y la lista de sus productos.
   */
  etiqueta(devolucionId: number): Observable<string> {
    return this.datos.consultar<string>(this.etiquetasGQL, { devolucionId });
  }

  // ───────────────────────────────────────────── Retiro a proveedor ──

  /**
   * Devoluciones listas para que el proveedor las retire, cada una con sus
   * productos. Sin `sucursalId`, de todas las sucursales.
   */
  consolidadoRetiro(
    proveedorId: number,
    sucursalId?: number | null,
  ): Observable<RetiroProveedorConsolidado> {
    return this.datos.consultar<RetiroProveedorConsolidado>(this.consolidadoGQL, {
      proveedorId,
      sucursalId: sucursalId ?? null,
    });
  }

  /**
   * Pasa las devoluciones a RETIRADO.
   *
   * ⚠️ **Es parcialmente exitosa.** Que la mutation no falle no quiere decir
   * que se retiraron todas: hay que recorrer `resultados` y avisar de las que
   * vuelven con `ok: false`.
   */
  retirar(devolucionIds: number[], usuarioId: number): Observable<RetiroBloqueResultado> {
    return this.datos.mutar<RetiroBloqueResultado>(this.retirarGQL, {
      devolucionIds,
      usuarioId,
    });
  }

  /** Comprobante de retiro en base64, para abrir con `PdfService`. */
  comprobanteRetiro(devolucionIds: number[]): Observable<string> {
    return this.datos.consultar<string>(this.comprobanteGQL, { devolucionIds });
  }

  /** Si el retiro deja marcar una devolución sin escanear su etiqueta. */
  configuracionRetiro(): Observable<DevolucionConfiguracionRetiro> {
    return this.datos.consultar<DevolucionConfiguracionRetiro>(this.configuracionGQL);
  }
}
