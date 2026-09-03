import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { enteFinancialSummaryQuery } from './graphql-query';

/**
 * Lo que el central sabe de la deuda de un activo.
 *
 * ⚠️ El campo se llama `getEnteFinancialSummary`; `EnteFinancialSummary`, sin
 * el `get`, es el tipo de retorno.
 */
export interface ResumenFinancieroEnte {
  enteId?: number;
  descripcion?: string;
  montoTotal?: number;
  montoYaPagado?: number;
  montoPendiente?: number;
  cuotasTotales?: number;
  cuotasPagadas?: number;
  cuotasFaltantes?: number;
  diaVencimiento?: number;
  diasParaVencer?: number;
  estadoCuota?: string;
  monedaSimbolo?: string;
  monedaId?: number;
  proveedorNombre?: string;
  proveedorId?: number;
  situacionPago?: string;
  porcentajePagado?: number;
  montoSugerido?: number;
  descripcionSugerida?: string;
  autocompletarMonto?: boolean;
  numeroCuotaActual?: number;
  fechaVencimientoSugerida?: string;
}

export interface Response {
  data?: ResumenFinancieroEnte;
}

@Injectable({ providedIn: 'root' })
export class EnteFinancialSummaryGQL extends Query<Response> {
  document = enteFinancialSummaryQuery;
}
