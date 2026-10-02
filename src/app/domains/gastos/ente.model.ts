import { TipoEnte } from './tipo-gasto.reglas';

/**
 * El activo al que se imputa un gasto, en el catálogo financiero.
 *
 * No es lo mismo que el activo en sí: el `Ente` es la ficha que lo vincula a
 * las finanzas, y se crea al vuelo la primera vez que alguien le imputa algo.
 */
export interface Ente {
  id?: number;
  tipoEnte?: TipoEnte;
  referenciaId?: number;
  descripcion?: string;
  activo?: boolean;
}

export interface Vehiculo {
  id: number;
  chapa?: string;
  modelo?: { descripcion?: string; marca?: { descripcion?: string } };
}

export interface Mueble {
  id: number;
  descripcion?: string;
}

export interface Inmueble {
  id: number;
  nombreAsignado?: string;
}

export interface Equipo {
  id: number;
  identificador?: string;
  descripcion?: string;
  modelo?: { descripcion?: string; marca?: { descripcion?: string } };
}

export type ActivoBusqueda = Vehiculo | Mueble | Inmueble | Equipo;
