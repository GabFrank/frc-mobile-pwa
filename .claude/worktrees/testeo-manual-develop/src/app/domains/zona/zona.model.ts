import { dateToString } from 'src/app/generic/utils/dateUtils';
import { Usuario } from '../personas/usuario.model';
import { Sector } from '../sector/sector.model';

/**
 * La unidad de conteo de un inventario: un tramo concreto del local dentro
 * de un sector.
 *
 * ⚠️ **`activo` es booleano, no numérico.** `frc-mobile` lo declara `number`
 * y el schema del central lo tiene como `Boolean` — mandar un número por
 * `ZonaInput.activo` lo rechaza la validación de GraphQL antes de llegar al
 * resolver. Se corrige acá porque esta es la primera pantalla que escribe
 * zonas; en el repo viejo el error nunca saltó porque el toggle de Ionic ya
 * entregaba booleanos y el tipo era solo decorativo.
 */
export class Zona {
    id?: number;
    sector?: Sector;
    descripcion?: string;
    activo?: boolean;
    usuario?: Usuario;
    creadoEn?: Date;

    toInput(): ZonaInput {
        let input = new ZonaInput;
        input.id = this.id;
        input.sectorId = this.sector?.id;
        input.descripcion = this.descripcion;
        input.activo = this.activo;
        input.creadoEn = dateToString(this.creadoEn);
        return input;
    }
}

export class ZonaInput {
    id?: number;
    sectorId?: number;
    descripcion?: string;
    activo?: boolean;
    usuarioId?: number;
    creadoEn?: string;
}
