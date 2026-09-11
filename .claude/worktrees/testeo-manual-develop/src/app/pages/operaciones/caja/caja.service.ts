import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { Mutation } from 'src/app/core/graphql/gql-base';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  CajaBalance,
  CajaFilialOperacionResult,
  PdvCaja,
  PdvCajaInput,
} from 'src/app/domains/caja/caja.model';
import { AbrirCajaGQL } from './graphql/abrirCaja';
import { BalancePorFechaGQL } from './graphql/balancePorFecha';
import { CajaAbiertoPorUsuarioIdLocalGQL } from './graphql/cajaAbiertoPorUsuarioIdLocal';
import { CajaPorIdGQL } from './graphql/cajaPorId';
import { CajasPorUsuarioIdGQL } from './graphql/cajasPorUsuario';
import { CerrarCajaGQL } from './graphql/cerrarCaja';
import { ImprimirBalanceGQL } from './graphql/imprimirBalance';

/**
 * Caja de punto de venta.
 *
 * ⚠️ **El balance y las diferencias los calcula el backend.** `diferenciaGs`
 * define si un cajero responde por dinero faltante; recalcularlo acá abriría
 * la puerta a discrepancias en un dato con consecuencias laborales.
 * Se muestra tal cual viene. Ver `docs/modulos/operaciones-caja.md`.
 */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly datos = inject(DatosService);
  private readonly notificacion = inject(NotificacionService);
  private readonly porIdGQL = inject(CajaPorIdGQL);
  private readonly porUsuarioGQL = inject(CajasPorUsuarioIdGQL);
  private readonly abiertaLocalGQL = inject(CajaAbiertoPorUsuarioIdLocalGQL);
  private readonly abrirGQL = inject(AbrirCajaGQL);
  private readonly cerrarGQL = inject(CerrarCajaGQL);
  private readonly balanceGQL = inject(BalancePorFechaGQL);
  private readonly imprimirGQL = inject(ImprimirBalanceGQL);

  porId(id: number, sucId?: number): Observable<PdvCaja> {
    return this.datos.porId<PdvCaja>(this.porIdGQL, id, { sucId });
  }

  /**
   * Cajas abiertas del usuario, consultando **solo la base local del central**.
   *
   * Es la variante a usar por defecto: el proxy multi-filial era lento y
   * frágil, y se reemplazó por esta consulta (PR #86 de `frc-mobile`).
   */
  abiertasDelUsuario(usuarioId: number): Observable<PdvCaja[]> {
    return this.datos.porId<PdvCaja[]>(this.abiertaLocalGQL, usuarioId);
  }

  historialDelUsuario(usuarioId: number, offset = 0): Observable<PdvCaja[]> {
    return this.datos.consultar<PdvCaja[]>(this.porUsuarioGQL, { id: usuarioId, offset });
  }

  /**
   * Abre la caja junto con su arqueo inicial, en una sola operación.
   *
   * No se separa en dos pasos a propósito: una caja abierta sin arqueo hace
   * que la diferencia al cierre no sea calculable.
   *
   * ⚠️ `input.sucursalId` es obligatorio: el central lo usa para resolver la
   * IP de la filial a la que proxear. Sin él aborta con `exito: false`
   * (`PdvCajaGraphQL.java:244`).
   */
  abrir(
    input: PdvCajaInput,
    conteoInput: Record<string, unknown>,
    conteoMonedaInputList: unknown[],
  ): Observable<boolean> {
    return this.operar(this.abrirGQL, { input, conteoInput, conteoMonedaInputList }, 'Caja abierta');
  }

  /**
   * Cierra la caja con su arqueo final.
   *
   * Usa la misma mutation que `abrir()`: lo único que la convierte en cierre
   * es mandar `cajaId`. Ver el comentario en `graphql-query.ts`.
   */
  cerrar(
    cajaId: number,
    input: PdvCajaInput,
    conteoInput: Record<string, unknown>,
    conteoMonedaInputList: unknown[],
  ): Observable<boolean> {
    return this.operar(
      this.cerrarGQL,
      { cajaId, input, conteoInput, conteoMonedaInputList },
      'Caja cerrada',
    );
  }

  /**
   * Ejecuta abrir/cerrar y traduce `CajaFilialOperacionResult` a un booleano.
   *
   * El aviso de éxito NO se delega a `DatosService.mensajeExito`: la mutation
   * responde un **objeto** `{ exito, cajaId }`, y un objeto siempre es
   * "afirmativo". Con `exito: false` —filial sin IP, caja ya abierta, la
   * filial caída— el usuario vería "Caja abierta" sobre una operación que el
   * central rechazó. El chequeo tiene que ser sobre `exito`.
   */
  private operar(
    gql: Mutation<{ data?: CajaFilialOperacionResult }>,
    variables: Record<string, unknown>,
    mensajeExito: string,
  ): Observable<boolean> {
    return this.datos.mutar<CajaFilialOperacionResult>(gql, variables).pipe(
      map((resultado) => resultado?.exito === true),
      tap((ok) => {
        if (ok) {
          this.notificacion.ok(mensajeExito);
        } else {
          this.notificacion.danger('El servidor rechazó la operación. Revisá con soporte.');
        }
      }),
    );
  }

  /**
   * Balance por rango.
   *
   * ⚠️ Pasá siempre ambas fechas. `DatosService.porFecha` tiene un default
   * razonable (último día), pero el rango explícito evita sorpresas.
   */
  balancePorFecha(inicio: Date, fin: Date): Observable<CajaBalance> {
    return this.datos.porFecha<CajaBalance>(this.balanceGQL, inicio, fin);
  }

  /** El central lo expone como query, no como mutation. */
  imprimirBalance(id: number, sucursalId?: number): Observable<unknown> {
    return this.datos.consultar(this.imprimirGQL, { id, sucursalId });
  }
}
