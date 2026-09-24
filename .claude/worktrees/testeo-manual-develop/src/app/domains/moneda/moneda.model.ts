import { Usuario } from "src/app/domains/personas/usuario.model";
import { Pais } from "src/app/domains/general/pais.model";
import { MonedaBillete } from "./moneda-billetes/moneda-billetes.model";
import { MonedaInput } from "./moneda-input.model";

export class Moneda {
  id?: number;
  denominacion?: string;
  simbolo?: string;
  activo?: boolean;
  pais?: Pais;
  creadoEn?: Date;
  usuario?: Usuario;
  cambio?: number;
  imagen?: string;
  monedaBilleteList?: MonedaBillete[];

  toInput(): MonedaInput {
    let input = new MonedaInput();
    input.denominacion = this.denominacion;
    input.simbolo = this.simbolo;
    input.paisId = this.pais?.id;
    input.usuarioId = this.usuario?.id;
    return input;
  }
}
