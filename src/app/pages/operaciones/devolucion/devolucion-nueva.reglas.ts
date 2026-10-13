import { TipoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';

/**
 * Reglas del alta de una devolución, sin Angular en el medio.
 *
 * Viven acá y no en la pantalla para poder probarlas: deciden si se puede
 * guardar y, cuando no, qué le falta al operador.
 */

export interface DatosDevolucionNueva {
  /** `false` cuando la sucursal elegida no es un local que mueve stock. */
  sucursalOperable: boolean;
  /** `null` mientras nadie eligió a quién va la devolución. */
  tipo: TipoDevolucion | null;
  proveedorId: number | null;
  cantidadItems: number;
}

/**
 * Lo que falta para poder guardar, o `null` si está todo.
 *
 * ⚠️ **El tipo no tiene valor por defecto, a propósito.** Una devolución sin
 * proveedor solo puede terminar descartada: es pérdida de la empresa. Si la
 * pantalla lo asumiera, todo lo cargado desde el teléfono saldría así sin
 * que nadie lo decida — que es como funcionaba antes de que se pudiera
 * elegir.
 */
export function faltaParaGuardar(datos: DatosDevolucionNueva): string | null {
  if (!datos.sucursalOperable) {
    return 'Elegí la sucursal donde está el producto.';
  }
  if (datos.tipo == null) {
    return 'Elegí si la devolución va a un proveedor o sin proveedor.';
  }
  if (datos.tipo === TipoDevolucion.CON_PROVEEDOR && datos.proveedorId == null) {
    return 'Elegí el proveedor al que se le devuelve.';
  }
  if (datos.cantidadItems === 0) {
    return 'Agregá al menos un producto.';
  }
  return null;
}

/**
 * Tipo y proveedor tal como viajan en el input.
 *
 * ⚠️ **Sin proveedor no lleva `proveedorId`**, aunque en la pantalla haya
 * quedado uno elegido de antes de cambiar de opinión: una devolución
 * `SIN_PROVEEDOR` con proveedor aparecería en el retiro de ese proveedor y
 * no podría retirarse.
 *
 * ⚠️ **Con proveedor y sin id no se convierte en «sin proveedor»: lanza.**
 * Degradarla en silencio mandaría a descarte algo que el operador marcó para
 * reclamar. `faltaParaGuardar` lo impide antes; esto es la segunda barrera.
 */
export function destinoParaInput(
  tipo: TipoDevolucion,
  proveedorId: number | null,
): { tipo: TipoDevolucion; proveedorId?: number } {
  if (tipo === TipoDevolucion.CON_PROVEEDOR) {
    if (proveedorId == null) {
      throw new Error('Elegí el proveedor al que se le devuelve.');
    }
    return { tipo, proveedorId };
  }
  return { tipo: TipoDevolucion.SIN_PROVEEDOR };
}
