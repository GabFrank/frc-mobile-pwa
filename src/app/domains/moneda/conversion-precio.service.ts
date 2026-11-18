import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ConvertirPreciosDesdeGQL, ConvertirPreciosGQL, PreciosEnMoneda } from 'src/app/graphql/operaciones/moneda/convertirPrecios';

/**
 * Precios en otras monedas, convertidos por el central.
 *
 * ⚠️ **El cliente no multiplica por la cotización.** `frc-mobile` hacía
 * `precio * (1 / cambio)` en el kiosco, con el redondeo del navegador; acá el
 * importe llega convertido y redondeado con los decimales de la moneda, que
 * es lo que tiene que coincidir con lo que cobra la caja (regla 6).
 *
 * Silencioso: si el central no tiene la query —un central viejo— o falla,
 * devuelve una lista vacía y la pantalla sigue en guaraníes.
 */
@Injectable({ providedIn: 'root' })
export class ConversionPrecioService {
  private readonly datos = inject(DatosService);
  private readonly gql = inject(ConvertirPreciosGQL);
  private readonly gqlDesde = inject(ConvertirPreciosDesdeGQL);

  convertir(montosGs: (number | null)[]): Observable<PreciosEnMoneda[]> {
    return this.datos
      .consultar(
        this.gql,
        { montosGs },
        // `network-only`: una cotización cacheada de la mañana no sirve a la
        // tarde, y esta pantalla la mira un cliente.
        { mostrarCarga: false, notificarError: false, gql: { fetchPolicy: 'network-only' } },
      )
      .pipe(
        map((filas) => filas ?? []),
        catchError(() => of([])),
      );
  }

  /**
   * Los importes de `montos` están en `monedaOrigenId`, no en la moneda de
   * la empresa. Con `null` es `convertir()` de siempre.
   *
   * Si el central no tiene `convertirPreciosDesdeMobile` (uno viejo, que
   * tampoco tiene precios en otra moneda) se vuelve a `convertirPreciosMobile`
   * tratando el importe como de la empresa: la pantalla queda como hoy.
   */
  convertirDesde(montos: (number | null)[], monedaOrigenId: number | null): Observable<PreciosEnMoneda[]> {
    if (monedaOrigenId == null) {
      return this.convertir(montos);
    }
    return this.datos
      .consultar(
        this.gqlDesde,
        { montos, monedaOrigenId },
        { mostrarCarga: false, notificarError: false, gql: { fetchPolicy: 'network-only' } },
      )
      .pipe(
        map((filas) => filas ?? []),
        catchError(() => this.convertir(montos)),
      );
  }
}
