import { Moneda } from 'src/app/domains/moneda/moneda.model';

export interface PersonaResumen {
  id?: number;
  nombre?: string;
}

export interface TipoGasto {
  id?: number;
  descripcion?: string;
  activo?: boolean;
  autorizacion?: boolean;
  /** Decide qué activo hace falta. Ver `tipo-gasto.reglas.ts`. */
  moduloPadre?: string;
  /**
   * ⚠️ Se llama `tipoNaturaleza`, no `naturaleza`. Es el nombre del campo en
   * el central (`financiero/tipo_gasto.graphqls`). Con el nombre corto la
   * naturaleza llegaba `undefined` y `mostrarCuotasActivo` devolvía `false`
   * para todo gasto recurrente, sin que nada fallara.
   */
  tipoNaturaleza?: string;
  esPagoCuotaActivo?: boolean;
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

export type BeneficiarioTipo = 'PERSONA' | 'PROVEEDOR';

/**
 * Una fila del detalle financiero **como la maneja el formulario**, con los
 * campos todavía sin completar. `PreGastoDetalleFinanzasInput` es la versión
 * ya validada que viaja al central.
 */
export interface DetalleFinanciero {
  monto: number | null;
  monedaId: number | null;
  formaPago: string | null;
}

/** Lo que se necesita de una moneda para formatear un importe. */
export interface MonedaResumen {
  // ⚠️ GraphQL serializa el tipo `ID` como string: `monedas` devuelve
  // `{ id: "1", ... }`, no `{ id: 1, ... }`. El tipo admite las dos formas
  // para que comparar contra este `id` no asuma cuál llegó.
  id: number | string;
  denominacion?: string;
  simbolo?: string;
}

/** Una fila del detalle financiero. Una moneda por fila, sin repetir. */
export interface PreGastoDetalleFinanzasInput {
  monedaId: number;
  formaPago: string;
  monto: number;
}

/**
 * Lo que recibe `savePreGasto`.
 *
 * ⚠️ Viaja bajo el argumento `entity:`, que es lo que manda `DatosService.guardar`.
 * `saveEnte`, en el mismo flujo, lo recibe bajo `ente:`.
 */
export interface PreGastoInput {
  id?: number;
  sucursalId: number;
  sucursalCajaId?: number;
  funcionarioId?: number;
  tipoGastoId?: number;
  descripcion?: string;
  usuarioId?: number;
  nivelUrgencia?: string;
  beneficiarioProveedorId?: number;
  beneficiarioPersonaId?: number;
  fechaVencimiento?: string;
  enteId?: number;
  finanzas: PreGastoDetalleFinanzasInput[];
}
