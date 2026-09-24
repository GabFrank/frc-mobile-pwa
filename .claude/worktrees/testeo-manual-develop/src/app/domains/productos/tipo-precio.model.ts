import { Usuario } from "../personas/usuario.model";

export class TipoPrecio {
    id?: number;
    descripcion?: string;
    autorizacion?: boolean;
    activo?: boolean;
    creadoEn?: Date;
    usuario?: Usuario;
}
