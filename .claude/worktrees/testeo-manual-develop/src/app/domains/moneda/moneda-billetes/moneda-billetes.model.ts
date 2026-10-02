import { Usuario } from "src/app/domains/personas/usuario.model";
import { Moneda } from "../moneda.model";

export class MonedaBillete {
    id?:number;
    moneda?: Moneda;
    flotante?: boolean;
    papel?: boolean;
    activo?: boolean;
    valor?: number;
    creadoEn?: Date;
    usuario?: Usuario;
}

export class MonedaBilleteInput {
    id?:number;
    monedaId?: number;
    flotante?: boolean;
    papel?: boolean;
    activo?: boolean;
    valor?: number;
    creadoEn?: Date;
    usuarioId?: number;
}
