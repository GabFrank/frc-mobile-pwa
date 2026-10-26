/**
 * Retiro de devoluciones por el proveedor.
 *
 * Los nombres replican **exactamente** el schema del central
 * (`retiro-devolucion.graphqls`): Apollo no valida el schema al compilar, y un
 * campo mal escrito llega `undefined` sin error.
 */

/** Un producto de una devolución lista para retirar. */
export interface RetiroProducto {
  identificador?: string;
  devolucionId?: number | string;
  productoId?: number | string;
  descripcion?: string;
  /** En unidades de la presentación. */
  cantidad?: number;
  /** Factor de la presentación: `x1`, `x12`. */
  presentacion?: string;
  lote?: string;
  vencimiento?: string;
}

/**
 * Una devolución lista para retirar, con sus productos. Es lo que se escanea:
 * su etiqueta lleva un solo QR con el identificador.
 */
export interface RetiroDevolucionResumen {
  devolucionId?: number | string;
  identificador?: string;
  estado?: string;
  productos?: RetiroProducto[];
}

export interface RetiroSucursalGrupo {
  sucursalId?: number | string;
  sucursalNombre?: string;
  devolucionIds?: (number | string)[];
  devoluciones?: RetiroDevolucionResumen[];
}

export interface RetiroProveedorConsolidado {
  proveedorId?: number | string;
  proveedorNombre?: string;
  grupos?: RetiroSucursalGrupo[];
}

export interface RetiroDevolucionResultado {
  id?: number | string;
  ok?: boolean;
  mensaje?: string;
}

export interface RetiroBloqueResultado {
  resultados?: RetiroDevolucionResultado[];
}

/** Lo que se lee de la configuración del módulo para el retiro. */
export interface DevolucionConfiguracionRetiro {
  /** Si se puede marcar una devolución sin escanear su etiqueta. */
  retiroPermitirSeleccionManual?: boolean;
}
