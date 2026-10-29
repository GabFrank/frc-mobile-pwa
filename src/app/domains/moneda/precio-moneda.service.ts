import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import {
  PreciosEnOtraMonedaGQL,
  type PrecioEnOtraMoneda,
} from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { monedasPorPrecio } from './precio-moneda';

/**
 * Qué precios están en otra moneda que la de la empresa.
 *
 * Se pide **una vez por sesión** (al entrar) y otra tras guardar un precio,
 * no por producto: así el kiosco decide la moneda de un precio al instante,
 * sin consulta ni parpadeo, y en una base donde todo está en la moneda de la
 * empresa la lista llega vacía.
 *
 * Silencioso y sin lanzar. Si el central no la conoce (uno viejo) o falla,
 * `soportado` queda en `false` y el mapa vacío: todo se comporta como
 * siempre. El estado vive en `MonedasSesion`, que se limpia al salir.
 */
@Injectable({ providedIn: 'root' })
export class PrecioMonedaService {
  private readonly datos = inject(DatosService);
  private readonly sesion = inject(MonedasSesion);
  private readonly gql = inject(PreciosEnOtraMonedaGQL);

  private carga: Promise<void> | null = null;
  private generacion = 0;

  /** Pide la lista (de nuevo). Sirve para el login y para refrescar tras guardar. */
  cargar(): Promise<void> {
    const generacion = ++this.generacion;
    const carga = this.pedir(generacion);
    this.carga = carga;
    return carga;
  }

  /** Espera a que la lista esté resuelta; la pide si nadie lo hizo. */
  listo(): Promise<void> {
    return this.carga ?? this.cargar();
  }

  /** La moneda propia de un precio; `null` = la de la empresa. */
  monedaDe(precioId: number | string | null | undefined): Moneda | null {
    return precioId != null ? (this.sesion.preciosOtraMoneda().get(String(precioId)) ?? null) : null;
  }

  private async pedir(generacion: number): Promise<void> {
    let porPrecio = new Map<string, Moneda>();
    let soportado = false;
    try {
      const filas = await firstValueFrom(
        this.datos.consultar<PrecioEnOtraMoneda[]>(this.gql, undefined, {
          mostrarCarga: false,
          notificarError: false,
          // Tras guardar hay que ver la moneda recién escrita.
          gql: { fetchPolicy: 'network-only' },
        }),
      );
      porPrecio = monedasPorPrecio(filas);
      soportado = true;
    } catch {
      // Un central sin la consulta: todo en la moneda de la empresa.
    }
    if (generacion !== this.generacion) {
      return;
    }
    this.sesion.preciosOtraMoneda.set(porPrecio);
    this.sesion.preciosMonedaSoportado.set(soportado);
    this.sesion.preciosMonedaListos.set(true);
  }
}
