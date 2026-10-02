import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Sucursal } from './sucursal.model';
import { SucursalActualGQL } from './graphql/sucursalActual';
import { SucursalByIdGQL } from './graphql/sucursalById';
import { SucursalesGQL } from './graphql/sucursalesQuery';
import { SucursalesSearchGQL } from './graphql/sucursalesSearch';

/** Sucursales. Reescrito sobre `DatosService`. */
@Injectable({ providedIn: 'root' })
export class SucursalService {
  private readonly datos = inject(DatosService);
  private readonly todasGQL = inject(SucursalesGQL);
  private readonly porIdGQL = inject(SucursalByIdGQL);
  private readonly actualGQL = inject(SucursalActualGQL);
  private readonly buscarGQL = inject(SucursalesSearchGQL);

  todas(): Observable<Sucursal[]> {
    return this.datos.consultar<Sucursal[]>(this.todasGQL, undefined, {
      mostrarCarga: false,
    });
  }

  porId(id: number): Observable<Sucursal> {
    return this.datos.porId<Sucursal>(this.porIdGQL, id);
  }

  /** Sucursal de la instancia contra la que está apuntando la app. */
  actual(): Observable<Sucursal> {
    return this.datos.consultar<Sucursal>(this.actualGQL, undefined, {
      mostrarCarga: false,
    });
  }

  /**
   * ⚠️ **El central devuelve una página, no una lista.** Se desenvuelve el
   * `getContent` para que el llamador reciba un `Sucursal[]` plano.
   */
  buscar(texto: string): Observable<Sucursal[]> {
    return this.datos
      .porTexto<{ getContent?: Sucursal[] }>(this.buscarGQL, texto, undefined, {
        mostrarCarga: false,
      })
      .pipe(map((pagina) => pagina?.getContent ?? []));
  }
}
