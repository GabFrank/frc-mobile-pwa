import { Usuario } from "../personas/usuario.model"

export class Cobro {
  id?: number;
  sucursalId?: number;
  creadoEn?: Date;
  usuario?: Usuario;
  totalGs?: number;
}
