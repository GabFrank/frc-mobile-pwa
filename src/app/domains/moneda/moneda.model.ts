import { Usuario } from "src/app/domains/personas/usuario.model";
import { Pais } from "src/app/domains/general/pais.model";
import { MonedaBillete } from "./moneda-billetes/moneda-billetes.model";
import { MonedaInput } from "./moneda-input.model";

export class Moneda {
  id?: number;
  denominacion?: string;
  simbolo?: string;
  activo?: boolean;
  /** La moneda de la empresa. Una sola por base. */
  principal?: boolean;
  /** Decimales con los que se muestra y redondea. Lo define el central. */
  decimales?: number;
  /**
   * Código ISO 4217 (`PYG`, `USD`, `BRL`).
   *
   * ⚠️ Solo lo tiene un central con la configuración de moneda por módulo:
   * pedirlo en una query que también corre contra centrales viejos hace
   * fallar la query entera. Va solo en `moneda-modulo.ts`.
   */
  codigoIso?: string;
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
