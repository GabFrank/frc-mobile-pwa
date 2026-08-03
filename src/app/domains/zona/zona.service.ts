import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Zona } from './zona.model';
import { DeleteZonaGQL } from './graphql/deleteZona';
import { SaveZonaGQL } from './graphql/saveZona';
import { ZonaByIdGQL } from './graphql/zonaById';
import { ZonasGQL } from './graphql/zonasQuery';
import { ZonasSearchGQL } from './graphql/zonasSearch';

/** Zonas: la unidad de conteo asignable en un inventario. */
@Injectable({ providedIn: 'root' })
export class ZonaService {
  private readonly datos = inject(DatosService);
  private readonly todasGQL = inject(ZonasGQL);
  private readonly porIdGQL = inject(ZonaByIdGQL);
  private readonly guardarGQL = inject(SaveZonaGQL);
  private readonly eliminarGQL = inject(DeleteZonaGQL);
  private readonly buscarGQL = inject(ZonasSearchGQL);

  todas(): Observable<Zona[]> {
    return this.datos.consultar<Zona[]>(this.todasGQL);
  }

  porId(id: number): Observable<Zona> {
    return this.datos.porId<Zona>(this.porIdGQL, id);
  }

  buscar(texto: string): Observable<Zona[]> {
    return this.datos.porTexto<Zona[]>(this.buscarGQL, texto, undefined, {
      mostrarCarga: false,
    });
  }

  /** El backend devuelve solo un booleano de éxito, no la entidad guardada. */
  guardar(input: Record<string, unknown>): Observable<boolean> {
    return this.datos.guardar<boolean>(this.guardarGQL, input);
  }

  eliminar(id: number): Observable<boolean> {
    return this.datos.eliminar(this.eliminarGQL, id);
  }
}
