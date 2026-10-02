import { Usuario } from "../personas/usuario.model"

export class FormaPago {
  id?: number;
  descripcion?: String;
  movimientoCaja?: Boolean;
  activo?: Boolean;
  autorizacion?: Boolean;
  creadoEn?: Date;
  usuario?: Usuario;
}
