import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { DatosService, esFalloDeTransporte } from 'src/app/core/graphql/datos.service';
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
 * Silencioso y sin lanzar. Dos fallos distintos (#139):
 * - **el central no la conoce** (uno viejo, error de GraphQL): `soportado`
 *   en `false` y el mapa vacío, todo en la moneda de la empresa, como siempre;
 * - **no hubo respuesta** (red, timeout, 5xx): `sinRespuesta` en `true`. La
 *   lista no se sabe; `listo()` la vuelve a pedir.
 *
 * El estado vive en `MonedasSesion`, que se limpia al salir.
 */
/** Tope de la lectura de la lista: pasado esto, «no hubo respuesta». */
export const TOPE_LISTA_MS = 8000;

@Injectable({ providedIn: 'root' })
export class PrecioMonedaService {
  private readonly datos = inject(DatosService);
  private readonly sesion = inject(MonedasSesion);
  private readonly gql = inject(PreciosEnOtraMonedaGQL);

  private carga: Promise<void> | null = null;
  /** La lectura que todavía no terminó, si hay una. */
  private enCurso: Promise<void> | null = null;
  private generacion = 0;

  /** Pide la lista (de nuevo). Sirve para el login y para refrescar tras guardar. */
  cargar(): Promise<void> {
    const generacion = ++this.generacion;
    const carga: Promise<void> = this.pedir(generacion).finally(() => {
      if (this.enCurso === carga) this.enCurso = null;
    });
    this.carga = carga;
    this.enCurso = carga;
    return carga;
  }

  /**
   * Espera a que la lista esté resuelta. Si hay una lectura en curso, esa (dos
   * llamadas no hacen dos pedidos); si nadie la pidió o la última quedó sin
   * respuesta, la vuelve a pedir.
   */
  listo(): Promise<void> {
    if (this.enCurso) return this.enCurso;
    if (this.carga == null || this.sesion.preciosMonedaSinRespuesta()) return this.cargar();
    return this.carga;
  }

  /** La moneda propia de un precio; `null` = la de la empresa. */
  monedaDe(precioId: number | string | null | undefined): Moneda | null {
    return precioId != null ? (this.sesion.preciosOtraMoneda().get(String(precioId)) ?? null) : null;
  }

  private async pedir(generacion: number): Promise<void> {
    let porPrecio = new Map<string, Moneda>();
    let resultado: 'ok' | 'sinConsulta' | 'sinRespuesta';
    try {
      const filas = await firstValueFrom(
        this.datos
          .consultar<PrecioEnOtraMoneda[]>(this.gql, undefined, {
            mostrarCarga: false,
            notificarError: false,
            // Tras guardar hay que ver la moneda recién escrita.
            gql: { fetchPolicy: 'network-only' },
          })
          // Una red colgada (portal cautivo) no responde nunca: sin tope, el
          // kiosco esperaría para siempre. Un `TimeoutError` es transporte.
          .pipe(timeout(TOPE_LISTA_MS)),
      );
      porPrecio = monedasPorPrecio(filas);
      resultado = 'ok';
    } catch (err) {
      resultado = esFalloDeTransporte(err) ? 'sinRespuesta' : 'sinConsulta';
    }
    if (generacion !== this.generacion) {
      return;
    }
    if (resultado === 'sinRespuesta') {
      // No se sabe: lo que había queda, pero marcado; nadie debe confiar en él.
      this.sesion.preciosMonedaSinRespuesta.set(true);
    } else {
      // `sinConsulta`: un central sin la consulta, todo en la moneda de la empresa.
      this.sesion.preciosOtraMoneda.set(porPrecio);
      this.sesion.preciosMonedaSoportado.set(resultado === 'ok');
      this.sesion.preciosMonedaSinRespuesta.set(false);
    }
    this.sesion.preciosMonedaListos.set(true);
  }
}
