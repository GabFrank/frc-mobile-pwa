import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  EstadoMarcacionUsuario,
  Marcacion,
  MarcacionInput,
} from 'src/app/domains/marcacion/marcacion.model';
import { EstadoMarcacionUsuarioGQL } from 'src/app/graphql/administrativo/marcacion/estadoMarcacionUsuario';
import { SaveMarcacionGQL } from 'src/app/graphql/administrativo/marcacion/saveMarcacion';

/**
 * Control de asistencia.
 *
 * ⚠️ **El estado lo decide el backend.** `estado()` dice qué corresponde
 * marcar ahora; la pantalla ofrece solo eso. Deducirlo del historial en el
 * cliente permite dos entradas seguidas.
 *
 * ⚠️ **No persiste ninguna sucursal, y es a propósito.** Hubo una elegida a
 * mano guardada en `localStorage`; se fue con la issue #15, porque la
 * sucursal ahora sale del GPS en cada marcación. Volver a guardarla sería
 * volver a tener un valor que gana sobre lo que dice la posición.
 */
@Injectable({ providedIn: 'root' })
export class MarcacionService {
  private readonly datos = inject(DatosService);
  private readonly guardarGQL = inject(SaveMarcacionGQL);
  private readonly estadoGQL = inject(EstadoMarcacionUsuarioGQL);

  estado(usuarioId: number): Observable<EstadoMarcacionUsuario> {
    return this.datos.consultar<EstadoMarcacionUsuario>(this.estadoGQL, { usuarioId });
  }

  guardar(input: MarcacionInput): Observable<Marcacion> {
    return this.datos.mutar<Marcacion>(this.guardarGQL, { entity: this.aWire(input) });
  }

  /**
   * Ajusta el input al tipo que declara el central antes de mandarlo.
   *
   * ⚠️ **`distanciaSucursalMetros` es `Int` en el esquema**, pero acá nace de
   * un cálculo de Haversine, que da decimales. Mandarlo crudo hace que
   * graphql-java rechace la mutation entera —«Variable 'entity' has an
   * invalid value: Expected type 'Int' but was 'Double'»— y la marcación no
   * se registra. El redondeo va acá, en el único punto por el que pasan
   * todas las marcaciones, y no en la pantalla: así no hay una segunda
   * pantalla que lo reintroduzca.
   *
   * `latitud`, `longitud` y `precisionGps` son `Float` y viajan intactos: el
   * metro de resolución alcanza para auditar una distancia, no para ubicar
   * un punto.
   */
  private aWire(input: MarcacionInput): MarcacionInput {
    const metros = input.distanciaSucursalMetros;
    return {
      ...input,
      distanciaSucursalMetros: Number.isFinite(metros) ? Math.round(metros!) : undefined,
    };
  }
}
