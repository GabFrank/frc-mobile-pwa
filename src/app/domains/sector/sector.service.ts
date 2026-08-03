import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Sector } from './sector.model';
import { DeleteSectorGQL } from './graphql/deleteSector';
import { SaveSectorGQL } from './graphql/saveSector';
import { SectorByIdGQL } from './graphql/sectorById';
import { SectoresGQL } from './graphql/sectoresQuery';
import { SectoresSearchGQL } from './graphql/sectoresSearch';

/** Sectores: agrupan zonas dentro de una sucursal. Ver docs/modulos/inventario.md. */
@Injectable({ providedIn: 'root' })
export class SectorService {
  private readonly datos = inject(DatosService);
  private readonly todosGQL = inject(SectoresGQL);
  private readonly porIdGQL = inject(SectorByIdGQL);
  private readonly guardarGQL = inject(SaveSectorGQL);
  private readonly eliminarGQL = inject(DeleteSectorGQL);
  private readonly buscarGQL = inject(SectoresSearchGQL);

  todos(): Observable<Sector[]> {
    return this.datos.consultar<Sector[]>(this.todosGQL);
  }

  porId(id: number): Observable<Sector> {
    return this.datos.porId<Sector>(this.porIdGQL, id);
  }

  buscar(texto: string): Observable<Sector[]> {
    return this.datos.porTexto<Sector[]>(this.buscarGQL, texto, undefined, {
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
