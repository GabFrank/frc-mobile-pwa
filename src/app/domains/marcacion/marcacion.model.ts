import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';

export enum TipoMarcacion {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
}

/** Qué corresponde marcar ahora. Lo decide el backend. */
export enum AccionMarcacionPendiente {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  RETORNO_ALMUERZO = 'RETORNO_ALMUERZO',
  SALIDA_DEFINITIVA = 'SALIDA_DEFINITIVA',
}

export enum EstadoJornada {
  NORMAL = 'NORMAL',
  INCOMPLETO = 'INCOMPLETO',
  AUSENTE = 'AUSENTE',
}

/**
 * Una marcación, con **la evidencia de dónde se hizo**.
 *
 * ⚠️ **Se guarda la evidencia, no solo el veredicto.** Una marcación a 300 m
 * con precisión de 500 m es un caso distinto de una a 300 m con precisión de
 * 5 m, y solo se pueden separar después si `latitud`, `longitud`,
 * `precisionGps` y `distanciaSucursalMetros` quedaron registrados.
 */
export interface Marcacion {
  id?: number;
  sucursalId?: number;
  usuario?: Usuario;
  tipo?: TipoMarcacion;
  latitud?: number;
  longitud?: number;
  precisionGps?: number;
  distanciaSucursalMetros?: number;
  deviceId?: string;
  deviceInfo?: string;
  sucursalEntrada?: Sucursal;
  fechaEntrada?: string;
  sucursalSalida?: Sucursal;
  fechaSalida?: string;
  presencial?: boolean;
  autorizacion?: number;
  codigo?: string;
  /**
   * ⚠️ **Una salida de almuerzo no cierra la jornada.** Tratarla como salida
   * normal la parte en dos y descuadra las horas trabajadas.
   */
  esSalidaAlmuerzo?: boolean;
}

export interface MarcacionInput {
  id?: number;
  sucursalId?: number;
  usuarioId: number;
  tipo: TipoMarcacion;
  latitud?: number;
  longitud?: number;
  precisionGps?: number;
  distanciaSucursalMetros?: number;
  deviceId?: string;
  deviceInfo?: string;
  sucursalEntradaId?: number;
  fechaEntrada?: string;
  sucursalSalidaId?: number;
  fechaSalida?: string;
  codigo?: string;
  /** Rostro. La PWA todavía no lo completa: ver `docs/modulos/marcacion.md`. */
  embedding?: number[];
  esSalidaAlmuerzo?: boolean;
}

/**
 * Jornada armada **por el backend**.
 *
 * ⚠️ **El cliente no empareja entradas con salidas.** El central resuelve
 * salidas de almuerzo, jornadas partidas y marcaciones huérfanas. Replicar
 * ese cálculo acá garantiza que en algún momento difieran.
 */
export interface Jornada {
  id?: number;
  sucursalId?: number;
  usuario?: Usuario;
  fecha?: string;
  marcacionEntrada?: Marcacion;
  marcacionSalidaAlmuerzo?: Marcacion;
  marcacionEntradaAlmuerzo?: Marcacion;
  marcacionSalida?: Marcacion;
  minutosTrabajados?: number;
  minutosExtras?: number;
  minutosLlegadaTardia?: number;
  minutosLlegadaTardiaAlmuerzo?: number;
  turno?: string;
  estado?: EstadoJornada;
  observacion?: string;
  actualizadoEn?: string;
}

/**
 * Qué puede marcar el usuario **ahora**.
 *
 * ⚠️ **Consultarlo antes de ofrecer marcar.** Ofrecer entrada y salida sin
 * preguntar permite dos entradas seguidas.
 */
export interface EstadoMarcacionUsuario {
  jornadaRelevante?: Jornada;
  accionPendiente?: AccionMarcacionPendiente;
  puedeMarcarEntrada?: boolean;
  puedeMarcarSalida?: boolean;
  puedeMarcarSalidaAlmuerzo?: boolean;
  puedeMarcarEntradaAlmuerzo?: boolean;
  estaEnJornada?: boolean;
}
