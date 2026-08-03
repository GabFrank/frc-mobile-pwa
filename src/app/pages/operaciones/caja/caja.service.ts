import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { CajaBalance, PdvCaja } from 'src/app/domains/caja/caja.model';
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
   */
  abrir(
    cajaInput: Record<string, unknown>,
    conteoInput: Record<string, unknown>,
    conteoMonedaInputList: unknown[],
  ): Observable<boolean> {
    return this.datos.mutar<boolean>(
      this.abrirGQL,
      { cajaInput, conteoInput, conteoMonedaInputList },
      { mensajeExito: 'Caja abierta' },
    );
  }

  /** Cierra la caja con su arqueo final. `sucursalId` es obligatorio. */
  cerrar(
    cajaId: number,
    sucursalId: number,
    conteoInput: Record<string, unknown>,
    conteoMonedaInputList: unknown[],
  ): Observable<boolean> {
    return this.datos.mutar<boolean>(
      this.cerrarGQL,
      { cajaId, sucursalId, conteoInput, conteoMonedaInputList },
      { mensajeExito: 'Caja cerrada' },
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
