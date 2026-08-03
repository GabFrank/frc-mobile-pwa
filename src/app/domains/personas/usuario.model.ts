import { InicioSesion } from "../configuracion/inicio-sesion.model";
import { Persona } from "./persona.model";
import { Sucursal } from "../empresarial/sucursal/sucursal.model";

export class Usuario {
  id?: number;
  persona?: Persona;
  email?: string;
  password?: string;
  nickname?: string;
  creadoEn?: Date;
  usuario?: Usuario;
  roles?: string[];
  avatar?: string;
  inicioSesion?: InicioSesion;
  /** Viene en la query de login (`usuarioParaLogin`). */
  sucursal?: Sucursal;

  toInput(): UsuarioInput {
    let input = new UsuarioInput;
    input.id = this.id
    input.personaId = this.persona?.id
    input.password = this.password
    input.nickname = this.nickname
    input.usuarioId = this.usuario?.id
    return input;
  }
}

export class UsuarioInput {
  id?: number;
  personaId?: number;
  password?: string;
  nickname?: string;
  usuarioId?: number;
}
