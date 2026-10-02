import { Presentacion } from "./presentacion.model";

export class Codigo {
    id?: number;
    codigo?: string;
    principal?: boolean;
    presentacion?: Presentacion;
    activo?: boolean;
    creadoEn?: Date;

    toInput(): CodigoInput{
        let input = new CodigoInput()
        input.id = this?.id;
        input.codigo = this?.codigo;
        input.principal = this?.principal;
        input.activo = this?.activo;
        input.presentacionId = this?.presentacion?.id;
        return input;
    }

}

export class CodigoInput {
  id?: number;
  codigo?: string;
  principal?: boolean;
  activo?: boolean;
  presentacionId?: number;
  usuarioId?: number;
  creadoEn?: Date;
}
