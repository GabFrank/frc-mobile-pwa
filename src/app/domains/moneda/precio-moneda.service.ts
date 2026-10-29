import { inject, Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import { PreciosMonedaPorPresentacionGQL } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { monedasPorPrecio } from './precio-moneda';

export interface MonedasDePrecios {
  /**
   * `false` si el central no contestó: es uno viejo (o no hay red) y los
   * precios se tratan como siempre, todos en la moneda de la empresa.
   */
  soportado: boolean;
  /** Moneda propia de cada precio que la tiene, por id de precio como texto. */
  porPrecio: Map<string, Moneda>;
}

/**
 * La moneda en la que está cada precio de una presentación.
 *
 * Silencioso y sin lanzar: es una consulta aparte justamente para poder
 * fallar sin romper nada (ver `preciosMonedaPorPresentacionQuery`).
 */
@Injectable({ providedIn: 'root' })
export class PrecioMonedaService {
  private readonly datos = inject(DatosService);
  private readonly gql = inject(PreciosMonedaPorPresentacionGQL);

  cargar(presentacionId: number): Observable<MonedasDePrecios> {
    return defer(() =>
      this.datos.consultar<{ id: number | string; moneda?: Partial<Moneda> | null }[]>(
        this.gql,
        { id: presentacionId },
        // `network-only`: tras guardar hay que ver la moneda recién escrita.
        { mostrarCarga: false, notificarError: false, gql: { fetchPolicy: 'network-only' } },
      ),
    ).pipe(
      map((filas) => ({ soportado: true, porPrecio: monedasPorPrecio(filas) })),
      catchError(() => of({ soportado: false, porPrecio: new Map<string, Moneda>() })),
    );
  }
}
