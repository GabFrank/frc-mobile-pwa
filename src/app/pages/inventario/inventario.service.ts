import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  Inventario,
  InventarioProductoItem,
  InventarioProductoItemInput,
} from 'src/app/domains/inventario/inventario.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { CancelarInventarioGQL } from 'src/app/graphql/inventario/cancelarInventario';
import { FinalizarInventarioGQL } from 'src/app/graphql/inventario/finalizarInventario';
import { InventarioAbiertoPorSucursalGQL } from 'src/app/graphql/inventario/inventarioAbiertoPorSucursal';
import { InventarioPorIdGQL } from 'src/app/graphql/inventario/inventarioPorId';
import { InventariosPorUsuarioGQL } from 'src/app/graphql/inventario/inventariosPorUsuario';
import { ItemsParaRevisarGQL } from 'src/app/graphql/inventario/itemsParaRevisar';
import { ReabrirInventarioGQL } from 'src/app/graphql/inventario/reabrirInventario';
import { SaveInventarioProductoItemGQL } from 'src/app/graphql/inventario/saveInventarioProductoItem';
import type { OrdenRevision } from './revision-item';

/**
 * Toma de inventario físico.
 *
 * El conteo se organiza por **sector y zona** —la geografía del local— para
 * que varias personas cuenten en paralelo sin pisarse.
 */
@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(InventarioPorIdGQL);
  private readonly abiertosGQL = inject(InventarioAbiertoPorSucursalGQL);
  private readonly porUsuarioGQL = inject(InventariosPorUsuarioGQL);
  private readonly finalizarGQL = inject(FinalizarInventarioGQL);
  private readonly cancelarGQL = inject(CancelarInventarioGQL);
  private readonly reabrirGQL = inject(ReabrirInventarioGQL);
  private readonly guardarItemGQL = inject(SaveInventarioProductoItemGQL);
  private readonly paraRevisarGQL = inject(ItemsParaRevisarGQL);

  porId(id: number): Observable<Inventario> {
    return this.datos.porId<Inventario>(this.porIdGQL, id);
  }

  /**
   * Inventarios abiertos de una sucursal.
   *
   * ⚠️ **Consultarlo antes de crear uno nuevo.** Dos inventarios abiertos a
   * la vez en la misma sucursal producen conteos que se pisan.
   */
  abiertosDe(sucursalId: number): Observable<Inventario[]> {
    return this.datos
      .porId<Inventario[]>(this.abiertosGQL, sucursalId)
      .pipe(map((lista) => lista ?? []));
  }

  delUsuario(usuarioId: number, page = 0, size = 10): Observable<PageInfo<Inventario>> {
    return this.datos.consultar<PageInfo<Inventario>>(this.porUsuarioGQL, {
      usuarioId,
      page,
      size,
      sortOrder: 'DESC',
    });
  }

  /**
   * Los ítems de un inventario, paginados, para revisarlos.
   *
   * ⚠️ **`orden` no recorta la lista.** El central lo aplica en un `ORDER BY`
   * que sube a los que coinciden; los demás siguen viniendo. Se llama `orden`
   * y no `filtro` —como en el central— porque un nombre que prometa filtrar
   * hace leer «no hay ninguno» donde en realidad dice «ninguno primero».
   */
  itemsParaRevisar(
    inventarioId: number,
    orden: OrdenRevision,
    page = 0,
    size = 10,
  ): Observable<PageInfo<InventarioProductoItem>> {
    return this.datos.consultar<PageInfo<InventarioProductoItem>>(this.paraRevisarGQL, {
      inventarioId,
      filtro: orden,
      page,
      size,
    });
  }

  /**
   * Cierra el inventario y **aplica las diferencias**.
   *
   * No es solo un cambio de estado: lo que quedó sin contar entra como
   * diferencia contra el sistema. Por eso la pantalla lo confirma antes.
   */
  finalizar(id: number): Observable<Inventario> {
    return this.datos.mutar<Inventario>(this.finalizarGQL, { id });
  }

  cancelar(id: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.cancelarGQL, { id });
  }

  reabrir(id: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.reabrirGQL, { id });
  }

  /**
   * Guarda un conteo.
   *
   * ⚠️ **`cantidad` no se toca.** Es lo que dice el sistema; lo que se contó
   * va en `cantidadFisica`, y la diferencia entre las dos **es** el resultado
   * del inventario.
   */
  guardarItem(input: InventarioProductoItemInput): Observable<InventarioProductoItem> {
    return this.datos.mutar<InventarioProductoItem>(this.guardarItemGQL, { entity: input });
  }
}
