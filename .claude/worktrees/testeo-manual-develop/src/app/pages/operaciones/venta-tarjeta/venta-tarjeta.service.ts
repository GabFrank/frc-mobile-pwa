import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  VentaTarjeta,
  VentaTarjetaInput,
} from 'src/app/domains/venta-tarjeta/venta-tarjeta.model';
import { ConfiguracionVentaTarjetaGQL } from 'src/app/graphql/operaciones/venta-tarjeta/configuracionVentaTarjeta';
import { CountVentasTarjetaSinRegistrarGQL } from 'src/app/graphql/operaciones/venta-tarjeta/countVentasTarjetaSinRegistrar';
import { SaveVentaTarjetaGQL } from 'src/app/graphql/operaciones/venta-tarjeta/saveVentaTarjeta';
import { UpdateVentaTarjetaGQL } from 'src/app/graphql/operaciones/venta-tarjeta/updateVentaTarjeta';
import { VentaTarjetaPorIdGQL } from 'src/app/graphql/operaciones/venta-tarjeta/ventaTarjetaPorId';
import { VentaTarjetaPorVentaIdGQL } from 'src/app/graphql/operaciones/venta-tarjeta/ventaTarjetaPorVentaId';
import { VentasTarjetaPorCajaGQL } from 'src/app/graphql/operaciones/venta-tarjeta/ventasTarjetaPorCaja';

/** Cuánto vale el flag cacheado antes de volver a preguntar. */
const TTL_MS = 5 * 60 * 1000;

/**
 * Conciliación de ventas cobradas con tarjeta.
 *
 * ⚠️ **Todas las consultas exigen `sucId`.** No hay variantes sin sucursal:
 * el registro siempre está acotado a una, y la que vale es la del QR — la
 * emitió la filial, y el central puede tener otro id para esa misma
 * sucursal.
 */
@Injectable({ providedIn: 'root' })
export class VentaTarjetaService {
  private readonly datos = inject(DatosService);
  private readonly configGQL = inject(ConfiguracionVentaTarjetaGQL);
  private readonly guardarGQL = inject(SaveVentaTarjetaGQL);
  private readonly actualizarGQL = inject(UpdateVentaTarjetaGQL);
  private readonly porIdGQL = inject(VentaTarjetaPorIdGQL);
  private readonly porVentaGQL = inject(VentaTarjetaPorVentaIdGQL);
  private readonly porCajaGQL = inject(VentasTarjetaPorCajaGQL);
  private readonly contarGQL = inject(CountVentasTarjetaSinRegistrarGQL);

  private habilitadaEn = 0;
  private readonly _habilitada = signal<boolean | null>(null);

  /**
   * Flag de habilitación, cacheado 5 minutos.
   *
   * `null` significa «no se sabe», no «deshabilitada»: es lo que distingue
   * el primer arranque de una respuesta negativa.
   */
  habilitadaCacheada(maxEdadMs = TTL_MS): boolean | null {
    if (this._habilitada() === null) {
      return null;
    }
    return Date.now() - this.habilitadaEn <= maxEdadMs ? this._habilitada() : null;
  }

  /** Consulta el flag y refresca el caché. */
  habilitada(): Observable<boolean> {
    return this.datos
      // Sin toast ni barra de carga: el guard la consulta en cada navegación.
      .consultar<{ habilitado?: boolean }>(this.configGQL, undefined, {
        mostrarCarga: false,
        notificarError: false,
      })
      .pipe(
        map((config) => config?.habilitado === true),
        tap((valor) => {
          this._habilitada.set(valor);
          this.habilitadaEn = Date.now();
        }),
      );
  }

  guardar(input: VentaTarjetaInput): Observable<VentaTarjeta> {
    return this.datos.mutar<VentaTarjeta>(this.guardarGQL, { entity: input });
  }

  actualizar(input: VentaTarjetaInput): Observable<VentaTarjeta> {
    return this.datos.mutar<VentaTarjeta>(this.actualizarGQL, { entity: input });
  }

  porId(id: number, sucId: number): Observable<VentaTarjeta> {
    return this.datos.consultar<VentaTarjeta>(this.porIdGQL, { id, sucId });
  }

  porVenta(ventaId: number, sucId: number): Observable<VentaTarjeta> {
    return this.datos.consultar<VentaTarjeta>(this.porVentaGQL, { ventaId, sucId });
  }

  porCaja(cajaId: number, sucId: number): Observable<VentaTarjeta[]> {
    return this.datos
      .consultar<VentaTarjeta[]>(this.porCajaGQL, { id: cajaId, sucId })
      .pipe(map((lista) => lista ?? []));
  }

  /** Cuántos cupones de esa caja siguen sin registrar. */
  pendientes(cajaId: number, sucId: number): Observable<number> {
    return this.datos
      .consultar<number>(this.contarGQL, { id: cajaId, sucId }, {
        mostrarCarga: false,
        notificarError: false,
      })
      .pipe(
        map((n) => n ?? 0),
        // El contador es informativo: si falla, la pantalla sigue sirviendo.
        catchError(() => of(0)),
      );
  }
}
