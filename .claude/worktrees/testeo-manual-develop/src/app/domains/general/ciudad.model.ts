import { Usuario } from "../personas/usuario.model";

export class Ciudad {
    id?: number;
    descripcion?: string;
    creadoEn?: Date;
    usuario?: Usuario;
  }