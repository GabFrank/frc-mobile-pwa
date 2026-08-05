import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import {
  EstadoMarcacionUsuario,
  Marcacion,
  MarcacionInput,
} from 'src/app/domains/marcacion/marcacion.model';
import { EstadoMarcacionUsuarioGQL } from 'src/app/graphql/administrativo/marcacion/estadoMarcacionUsuario';
import { SaveMarcacionGQL } from 'src/app/graphql/administrativo/marcacion/saveMarcacion';

const CLAVE_SUCURSAL = 'frc.marcacion.sucursal';

/**
 * Control de asistencia.
 *
 * ⚠️ **El estado lo decide el backend.** `estado()` dice qué corresponde
 * marcar ahora; la pantalla ofrece solo eso. Deducirlo del historial en el
 * cliente permite dos entradas seguidas.
 */
@Injectable({ providedIn: 'root' })
export class MarcacionService {
  private readonly datos = inject(DatosService);
  private readonly guardarGQL = inject(SaveMarcacionGQL);
  private readonly estadoGQL = inject(EstadoMarcacionUsuarioGQL);

  /** Última sucursal elegida, para no volver a preguntarla cada vez. */
  private readonly _sucursal = signal<Sucursal | null>(this.leerSucursal());
  readonly sucursalPersistida = this._sucursal.asReadonly();

  estado(usuarioId: number): Observable<EstadoMarcacionUsuario> {
    return this.datos.consultar<EstadoMarcacionUsuario>(this.estadoGQL, { usuarioId });
  }

  guardar(input: MarcacionInput): Observable<Marcacion> {
    return this.datos.mutar<Marcacion>(this.guardarGQL, { entity: input });
  }

  /**
   * Guarda la sucursal elegida, o la borra con `null`.
   *
   * ⚠️ **`removeItem`, no `setItem(clave, null)`.** Lo segundo persiste la
   * cadena `"null"`, que después se lee como un valor válido. Es el bug #4
   * del TODO técnico del repo anterior, y este módulo era justamente el
   * único que lo hacía bien.
   */
  guardarSucursal(sucursal: Sucursal | null): void {
    if (!sucursal) {
      this.limpiarSucursal();
      return;
    }
    localStorage.setItem(CLAVE_SUCURSAL, JSON.stringify(sucursal));
    this._sucursal.set(sucursal);
  }

  /**
   * ⚠️ **Se limpia al cerrar sesión.** La sucursal es del funcionario, no del
   * dispositivo: si no se borra, el próximo usuario que entre en ese teléfono
   * marca contra la sucursal del anterior.
   */
  limpiarSucursal(): void {
    localStorage.removeItem(CLAVE_SUCURSAL);
    this._sucursal.set(null);
  }

  private leerSucursal(): Sucursal | null {
    const crudo = localStorage.getItem(CLAVE_SUCURSAL);
    if (!crudo) {
      return null;
    }
    try {
      return JSON.parse(crudo) as Sucursal;
    } catch {
      // Dato corrupto: se limpia en vez de arrastrarlo en cada arranque.
      localStorage.removeItem(CLAVE_SUCURSAL);
      return null;
    }
  }
}
