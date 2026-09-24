import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Zona } from './zona.model';
import { DeleteZonaGQL } from './graphql/deleteZona';
import { SaveZonaGQL } from './graphql/saveZona';
import { ZonaByIdGQL } from './graphql/zonaById';
import { ZonasGQL } from './graphql/zonasQuery';

/** Zonas: la unidad de conteo asignable en un inventario. */
@Injectable({ providedIn: 'root' })
export class ZonaService {
  private readonly datos = inject(DatosService);
  private readonly todasGQL = inject(ZonasGQL);
  private readonly porIdGQL = inject(ZonaByIdGQL);
  private readonly guardarGQL = inject(SaveZonaGQL);
  private readonly eliminarGQL = inject(DeleteZonaGQL);

  todas(): Observable<Zona[]> {
    return this.datos.consultar<Zona[]>(this.todasGQL);
  }

  porId(id: number): Observable<Zona> {
    return this.datos.porId<Zona>(this.porIdGQL, id);
  }


  /** Devuelve la zona guardada, con su id ya asignado si era nueva. */
  guardar(input: Record<string, unknown>): Observable<Zona> {
    return this.datos.guardar<Zona>(this.guardarGQL, input);
  }

  eliminar(id: number): Observable<boolean> {
    return this.datos.eliminar(this.eliminarGQL, id);
  }
}
