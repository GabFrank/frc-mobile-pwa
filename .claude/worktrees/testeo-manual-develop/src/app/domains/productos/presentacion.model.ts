import { Moneda } from "src/app/domains/moneda/moneda.model"
import { Usuario } from "../personas/usuario.model"
import { Codigo } from "./codigo.model"
import { PrecioPorSucursal } from "./precio-por-sucursal.model"
import { Producto } from "./producto.model"
import { TipoPresentacion } from "./tipo-presentacion.model"

export class Presentacion {
    id?:number;
    descripcion?: string;
    activo?: Boolean;
    principal?: Boolean;
    producto?: Producto;
    tipoPresentacion?: TipoPresentacion;
    cantidad?: number;
    creadoEn?: Date;
    imagenPrincipal?: string;
    usuario?: Usuario;
    codigos?: Codigo[];
    precios?: PrecioPorSucursal[];
    codigoPrincipal?: Codigo
    precioPrincipal?: PrecioPorSucursal;
    precioConvertido?: number;
}
