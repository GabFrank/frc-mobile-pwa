/**
 * Qué hacer al cargar un ítem de transferencia según el stock del origen.
 *
 * Misma regla que el desktop: stock positivo sigue; stock 0 pide
 * confirmación; stock negativo bloquea salvo que la configuración de
 * transferencias lo permita, y entonces pide confirmación.
 *
 * Lo que se confirma queda registrado por el central en el control de stock
 * negativo, que mira el equipo de inventario.
 */
export type DecisionAvisoStock = 'SEGUIR' | 'CONFIRMAR' | 'BLOQUEAR';

export function decidirAvisoStock(stock: number, permitirNegativo: boolean): DecisionAvisoStock {
  if (stock > 0) {
    return 'SEGUIR';
  }
  if (stock === 0) {
    return 'CONFIRMAR';
  }
  return permitirNegativo ? 'CONFIRMAR' : 'BLOQUEAR';
}

export function mensajeAvisoStock(stock: number): string {
  return stock === 0
    ? 'El producto tiene stock 0 en la sucursal de origen.'
    : 'El producto tiene stock negativo (' + stock + ') en la sucursal de origen.';
}
