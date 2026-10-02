import { Usuario } from "../personas/usuario.model"

export class TipoPresentacion {
    id?:number;
    descripcion?: String;
    unico?: Boolean;
    creadoEn?: Date;
    usuario?: Usuario;
}
