import { dateToString } from "src/app/generic/utils/dateUtils";
import { Sucursal } from "../empresarial/sucursal/sucursal.model";
import { TipoDispositivo } from "./enums/tipo-dispositivo.model";
import { Usuario } from "../personas/usuario.model";

export class InicioSesion {
  id?: number;
  usuario?: Usuario;
  sucursal?: Sucursal;
  tipoDespositivo?: TipoDispositivo;
  idDispositivo?: string;
  token?: string;
  horaInicio?: Date;
  horaFin?: Date;
  creadoEn?: Date;

  constructor(
    id?: number,
    usuario?: Usuario,
    sucursal?: Sucursal,
    tipoDespositivo?: TipoDispositivo,
    idDispositivo?: string,
    token?: string,
    horaInicio?: Date,
    horaFin?: Date,
    creadoEn?: Date
  ) {
    this.id = id;
    this.usuario = usuario;
    this.sucursal = sucursal;
    this.tipoDespositivo = tipoDespositivo;
    this.idDispositivo = idDispositivo;
    this.token = token;
    this.horaInicio = horaInicio;
    this.horaFin = horaFin;
    this.creadoEn = creadoEn;
  }

  toInput(): InicioSesionInput {
    let input = new InicioSesionInput();
    input.id = this.id;
    input.usuarioId = this.usuario?.id;
    input.sucursalId = this.sucursal?.id;
    input.tipoDespositivo = this.tipoDespositivo;
    input.idDispositivo = this.idDispositivo;
    input.token = this.token;
    input.horaInicio = dateToString(this.horaInicio);
    input.horaFin = dateToString(this.horaFin);
    input.creadoEn = dateToString(this.creadoEn);
    return input;
  }
}

export class InicioSesionInput {
  id?: number;
  usuarioId?: number;
  sucursalId?: number;
  tipoDespositivo?: TipoDispositivo;
  idDispositivo?: string;
  token?: string;
  horaInicio?: string;
  horaFin?: string;
  creadoEn?: string;
}
