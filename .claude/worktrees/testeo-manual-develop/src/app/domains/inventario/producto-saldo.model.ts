/**
 * Un producto con su saldo en una sucursal, para el control de inventario.
 *
 * El `saldoTotal` lo calcula el central sobre `movimiento_stock`: es la
 * diferencia acumulada, no algo que el cliente pueda derivar.
 */
export interface ProductoSaldo {
  productoId?: number;
  productoDescripcion?: string;
  sucursalId?: number;
  saldoTotal?: number;
  imagenPrincipal?: string;
}
