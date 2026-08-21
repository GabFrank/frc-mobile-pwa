import { Ciudad } from "../../general/ciudad.model";
import { Usuario } from "../../personas/usuario.model";

export class Sucursal {
  id?: number;
  nombre?: string;
  localizacion?: string;
  ciudad?: Ciudad;
  deposito?: boolean;
  depositoPredeterminado?: Boolean;
  creadoEn?: Date;
  usuario?: Usuario;
  ip?: string;
  puerto?: number;

  constructor(id?: number) {
    this.id = id;
  }
}
