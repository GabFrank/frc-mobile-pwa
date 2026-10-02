import { Sucursal } from "src/app/domains/empresarial/sucursal/sucursal.model";
import { Usuario } from "src/app/domains/personas/usuario.model";
import { Conteo } from 'src/app/domains/caja/conteo.model';
import { Maletin } from 'src/app/domains/caja/maletin.model';

export class PdvCaja {
  id?: number;
  descripcion?: string;
  sucursalId?: number;
  activo?: boolean;
  estado?: PdvCajaEstado;
  tuvoProblema?: boolean;
  fechaApertura?: Date;
  fechaCierre?: Date;
  observacion?: String;
  maletin?: Maletin;
  creadoEn?: Date;
  usuario?: Usuario;
  conteoApertura?: Conteo;
  conteoCierre?: Conteo;
  balance?: CajaBalance;
  sucursal?: Sucursal;

  toInput(): PdvCajaInput {
    let input = new PdvCajaInput;
    input.id = this.id
    input.sucursalId = this.sucursalId
    input.descripcion = this.descripcion
    input.activo = this.activo
    input.estado = this.estado
    input.tuvoProblema = this.tuvoProblema
    input.fechaApertura = this.fechaApertura
    input.fechaCierre = this.fechaCierre
    input.observacion = this.observacion
    input.maletinId = this.maletin?.id
    input.creadoEn = this.creadoEn
    input.usuarioId = this.usuario?.id
    input.conteoAperturaId = this.conteoApertura?.id
    input.conteoCierreId = this.conteoCierre?.id
    return input;
  }
}

export class PdvCajaInput {
  id?: number;
  sucursalId?: number;
  descripcion?: string;
  activo?: boolean;
  estado?: PdvCajaEstado;
  tuvoProblema?: boolean;
  fechaApertura?: Date;
  fechaCierre?: Date;
  observacion?: String;
  maletinId?: number;
  creadoEn?: Date;
  usuarioId?: number;
  conteoAperturaId?: number;
  conteoCierreId?: number;
}

export enum PdvCajaEstado {
  'En proceso' = 'EN_PROCESO',
  'Concluido' = 'CONCLUIDO',
  'Necesita verificacion' = 'NECESITA_VERIFICACION',
  'En verificacion' = 'EN_VERIFICACION',
  'Verificado y concluido sin problema' = 'VERIFICADO_CONCLUIDO_SIN_PROBLEMA',
  'Verificado y concluido con problema' = 'VERIFICADO_CONCLUIDO_CON_PROBLEMA'
}

export class CajaBalance {
  cajaId?: number;
  totalVentaGs?: number;
  totalVentaRs?: number;
  totalVentaDs?: number;
  totalTarjeta?: number;
  totalRetiroGs?: number;
  totalRetiroRs?: number;
  totalRetiroDs?: number;
  totalGastoGs?: number;
  totalGastoRs?: number;
  totalGastoDs?: number;
  totalDescuento?: number;
  totalAumento?: number;
  totalCanceladas?: number;
  totalAperGs?: number;
  totalAperRs?: number;
  totalAperDs?: number;
  totalCierreGs?: number;
  totalCierreRs?: number;
  totalCierreDs?: number;
  diferenciaGs?: number;
  diferenciaRs?: number;
  diferenciaDs?: number;
}

export interface CajaFilialOperacionResult {
  exito?: boolean;
  cajaId?: number;
}
