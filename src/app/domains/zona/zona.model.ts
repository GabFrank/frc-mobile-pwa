import { dateToString } from 'src/app/generic/utils/dateUtils';
import { Usuario } from '../personas/usuario.model';
import { Sector } from '../sector/sector.model';

export class Zona {
    id?: number;
    sector?: Sector;
    descripcion?: string;
    activo?: number;
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
    activo?: number;
    usuarioId?: number;
    creadoEn?: string;
}
