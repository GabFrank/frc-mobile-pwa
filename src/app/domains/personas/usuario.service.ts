import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { UsuarioSearchGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioSearch';
import { Usuario } from './usuario.model';

/**
 * Usuarios del sistema. Reescrito sobre `DatosService`, igual que
 * {@link SucursalService}.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly datos = inject(DatosService);
  private readonly buscarGQL = inject(UsuarioSearchGQL);

  /**
   * Búsqueda por texto.
   *
   * ⚠️ **Devuelve la lista entera, no una página.** A diferencia de
   * `SucursalService.buscar()`, `usuarioSearch` no envuelve el resultado en un
   * `getContent`: buscar ese campo acá devolvería vacío siempre.
   */
  buscar(texto: string): Observable<Usuario[]> {
    return this.datos.porTexto<Usuario[]>(this.buscarGQL, texto, undefined, {
      mostrarCarga: false,
    });
  }
}
