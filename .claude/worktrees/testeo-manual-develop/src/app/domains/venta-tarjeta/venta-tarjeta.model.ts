/** `PENDIENTE` = cobrada pero sin cupón registrado. `COMPLETADO` = conciliada. */
export enum VentaTarjetaEstado {
  PENDIENTE = 'PENDIENTE',
  COMPLETADO = 'COMPLETADO',
}

export interface TerminalPos {
  id?: number;
  codigo?: string;
  descripcion?: string;
  moneda?: { id?: number; simbolo?: string; denominacion?: string };
}

/**
 * Cupón bancario ligado a una venta del sistema.
 *
 * ⚠️ **`monto` y `montoEscaneado` son dos campos distintos a propósito.** Uno
 * es lo que carga el operador; el otro, lo que el OCR leyó del cupón
 * fotografiado. Guardar los dos permite auditar discrepancias entre lo
 * declarado y lo impreso. **No unificarlos**, aunque hoy la PWA no complete
 * el segundo.
 */
export interface VentaTarjeta {
  id?: number;
  sucursalId?: number;
  venta?: {
    id?: number;
    totalGs?: number;
    creadoEn?: string;
    usuario?: { id?: number; nickname?: string };
  };
  terminalPos?: TerminalPos;
  caja?: { id?: number };
  codigoAutorizacion?: string;
  numeroBoleta?: string;
  monto?: number;
  montoEscaneado?: number;
  imagenUrl?: string;
  estado?: VentaTarjetaEstado;
  usuario?: { id?: number; nickname?: string };
  creadoEn?: string;
}

export interface VentaTarjetaInput {
  id?: number;
  sucursalId?: number;
  ventaId?: number;
  terminalPosId?: number;
  cajaId?: number;
  codigoAutorizacion?: string;
  numeroBoleta?: string;
  monto?: number;
  montoEscaneado?: number;
  imagenUrl?: string;
  estado?: string;
  usuarioId?: number;
}
