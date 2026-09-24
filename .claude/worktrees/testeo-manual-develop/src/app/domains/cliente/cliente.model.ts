import { Sucursal } from "../empresarial/sucursal/sucursal.model"
import { Persona } from "../personas/persona.model"
import { Usuario } from "../personas/usuario.model"

export class Cliente {
  id?: number;
  tipo?: TipoCliente;
  persona?: Persona;
  nombre?: String;
  credito?: number;
  creadoEn?: Date;
  usuarioId?: Usuario;
  saldo?: number;
  codigo?: String;
  sucursal?: Sucursal;
}

export enum TipoCliente {
  NORMAL,
  ASOCIADO,
  CONVENIADO,
  FUNCIONARIO,
  VIP
}
