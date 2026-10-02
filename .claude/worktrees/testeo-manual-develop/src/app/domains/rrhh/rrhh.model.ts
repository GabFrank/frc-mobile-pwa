import { Usuario } from 'src/app/domains/personas/usuario.model';

/**
 * Modelos del autoservicio de RRHH.
 *
 * ⚠️ En `frc-mobile` este módulo devolvía `any` en **todos** sus métodos: era
 * el de menos tipado del repo (TODO_TECNICO). Acá se tipa contra el schema
 * del central, así que un campo mal escrito lo detecta el compilador y no
 * un `undefined` en pantalla.
 *
 * Son interfaces y no clases: son datos de lectura, sin `toInput()` ni
 * comportamiento. Las clases del repo anterior existían por costumbre.
 */

export interface Funcionario {
  id?: number;
  persona?: { id?: number; nombre?: string };
}

/** Cabecera del dashboard. Lo calcula el backend. */
export interface ResumenRrhh {
  funcionarioId?: number;
  nombre?: string;
  saldoVacacionesDias?: number;
  valesPendientesCantidad?: number;
  valesPendientesMonto?: number;
  ultimoReciboPeriodo?: string;
  ultimoReciboNeto?: number;
}

export type LiquidacionEstado = 'BORRADOR' | 'APROBADA' | 'PAGADA' | 'ANULADA';

/** Un recibo de sueldo. */
export interface Recibo {
  id?: number;
  periodo?: string;
  totalNeto?: number;
  estado?: LiquidacionEstado;
  fechaPago?: string;
}

export type ValeEstado = 'SOLICITADO' | 'CONFIRMADO' | 'DESCONTADO' | 'ANULADO';

export interface MotivoVale {
  id?: number;
  descripcion?: string;
}

/**
 * Vale o adelanto.
 *
 * ⚠️ **`esAdelanto` distingue dos cosas distintas, no es un detalle de UI.**
 * Un adelanto es dinero del sueldo del mes en curso; un vale común es un
 * préstamo que se descuenta en cuotas. La liquidación los trata distinto.
 */
export interface Vale {
  id?: number;
  monto?: number;
  fecha?: string;
  estado?: ValeEstado;
  esAdelanto?: boolean;
  motivo?: MotivoVale;
  funcionario?: Funcionario;
}

/** Saldo vacacional de un año de servicio. */
export interface Vacacion {
  id?: number;
  anioServicio?: number;
  diasGenerados?: number;
  diasGozados?: number;
}

export type VacacionPeriodoEstado =
  | 'SOLICITADA'
  | 'PROGRAMADA'
  | 'EN_CURSO'
  | 'GOZADA'
  | 'CANCELADA';

/**
 * Un pedido concreto de vacaciones: desde, hasta y cuántos días usa.
 *
 * ⚠️ **No trae al funcionario.** El tipo del central no expone ningún vínculo
 * hacia él, así que en la bandeja de aprobaciones no se puede saber de quién
 * es el pedido. Ver el comentario en `graphql/rrhh/graphql-query.ts`.
 */
export interface VacacionPeriodo {
  id?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  diasUsados?: number;
  estado?: VacacionPeriodoEstado;
  observacion?: string;
  autorizadoPor?: Usuario;
}

/** Un día de trabajo ya consolidado por el backend. */
export interface Jornada {
  id?: number;
  fecha?: string;
  minutosTrabajados?: number;
  minutosExtras?: number;
  minutosLlegadaTardia?: number;
  estado?: string;
}
