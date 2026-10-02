import { Moneda } from 'src/app/domains/moneda/moneda.model';

export interface PersonaResumen {
  id?: number;
  nombre?: string;
}

export interface TipoGasto {
  id?: number;
  descripcion?: string;
  /** Decide qué activo hace falta. Ver `tipo-gasto.reglas.ts`. */
  moduloPadre?: string;
  naturaleza?: string;
}

/** Montos retirados y devueltos, **por moneda**, no como lista. */
export interface PreGastoGasto {
  retiroGs?: number;
  retiroRs?: number;
  retiroDs?: number;
  vueltoGs?: number;
  vueltoRs?: number;
  vueltoDs?: number;
}

export interface GastoRendicion {
  id?: number;
  montoTotal?: number;
  /**
   * ⚠️ **Conviven singular y plural.** `fotoFacturaUrl` es el campo viejo, de
   * una sola foto; `fotosFacturaUrls` el nuevo. Para código nuevo, los
   * plurales; los singulares siguen por compatibilidad.
   */
  fotoFacturaUrl?: string;
  fotoProductoUrl?: string;
  fotosFacturaUrls?: string[];
  fotosProductoUrls?: string[];
  /** Combustible. */
  kmActual?: number;
  litros?: number;
  precioPorLitro?: number;
  /** Alimentación. */
  establecimientoAlimentacion?: string;
  /** Gasto en ruta. */
  ubicacionProvisoria?: string;
  creadoEn?: string;
  tipoGasto?: TipoGasto;
}

/**
 * Solicitud de caja chica.
 *
 * ⚠️ **`estado` y `estadoRendicion` son dos máquinas separadas.** Una
 * solicitud puede estar aprobada y retirada y tener la rendición todavía
 * pendiente. Mirar solo `estado` da una lectura incompleta.
 *
 * ⚠️ **`estadoEtiqueta`, `estadoColor` y `estadoIcono` los calcula el
 * backend.** No se recalculan acá: si el central agrega un estado, la UI lo
 * refleja sola mientras se usen estos campos. Es el patrón correcto y el
 * único módulo del repo que lo hace.
 */
export interface PreGasto {
  id?: number;
  sucursalId?: number;
  descripcion?: string;
  estado?: string;
  estadoRendicion?: string;
  estadoEtiqueta?: string;
  estadoColor?: string;
  estadoIcono?: string;
  montoSolicitado?: number;
  montoRetirado?: number;
  montoGastado?: number;
  /** Vuelto todavía sin devolver. */
  saldoDevolver?: number;
  /** Ata el retiro a **esta** solicitud puntual. */
  qrToken?: string;
  retiroConfirmadoEn?: string;
  cajaId?: number;
  creadoEn?: string;
  funcionario?: PersonaResumen;
  tipoGasto?: TipoGasto;
  moneda?: Moneda;
  sucursalCaja?: { id?: number; nombre?: string };
  /** Detalle multi-moneda de lo solicitado. */
  finanzas?: { monto?: number; moneda?: Moneda }[];
  gasto?: PreGastoGasto;
  rendiciones?: GastoRendicion[];
}

export interface ConfirmarRetiroInput {
  preGastoId: number;
  sucursalId: number;
  qrToken: string;
  funcionarioPersonaId: number;
}
