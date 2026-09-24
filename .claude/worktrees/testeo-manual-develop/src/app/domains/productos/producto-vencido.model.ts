/**
 * De dónde salió el vencimiento que se está mostrando.
 *
 * Un mismo lote puede tener fecha declarada en la compra, corregida en un
 * inventario y arrastrada por una transferencia. La «fuente de verdad» dice
 * cuál de esas tres se está usando, y es el motivo de que la fila muestre
 * además `referenciaInventario` cuando el inventario dice otra cosa.
 */
export type FuenteVerdadVencimiento = 'INVENTARIO' | 'COMPRA' | 'TRANSFERENCIA';

/** Cómo clasifica el central lo que está por vencerse. */
export type ClaseVencimiento = 'vencido' | 'por-vencer' | 'vigente';

/**
 * Fila del reporte de productos vencidos.
 *
 * ⚠️ **La presentación la calcula el central**, igual que en caja chica:
 * `diasVencimiento`, `diasVencimientoTexto` y la clasificación vienen
 * resueltos. El umbral de «por vencer» —hoy siete días— vive en
 * `ProductosVencidosService.java`; el cliente no lo repite, porque si allá
 * pasa a diez, acá tiene que seguirlo sin tocar nada.
 */
export interface ProductoVencido {
  id?: number;
  presentacionId?: number;
  presentacionCantidad?: number;
  productoId?: number;
  productoDescripcion?: string;
  codigoBarras?: string;
  cantidad?: number;
  vencimiento?: string;
  sucursalId?: number;
  sucursalNombre?: string;
  sectorDescripcion?: string;
  zonaDescripcion?: string;
  usuarioNickname?: string;
  fuenteVerdad?: FuenteVerdadVencimiento;
  /** Texto ya armado: «Nota de compra #123 (15/03/2026)». */
  detalleFuente?: string;
  /** Presente solo cuando el inventario contradice a la fuente elegida. */
  referenciaInventario?: string;
  diasVencimiento?: number;
  /** «Vencido hace 3 días», «Vence hoy», «12 días restantes». */
  diasVencimientoTexto?: string;
  /**
   * ⚠️ Llega como clase CSS del sistema viejo: `dias-vencimiento-cell
   * vencido`. Se lee la clasificación, no se aplica la clase.
   */
  diasVencimientoClase?: string;
  /**
   * ⚠️ **Hex crudo del backend. No usar.** `frc-mobile` lo inyectaba con
   * `[style.color]`, que en este repo viola la regla 2 —ningún color literal
   * fuera de los tokens— y además ignora el tema oscuro. Se conserva en el
   * modelo solo para documentar que existe y por qué se descarta.
   */
  vencimientoColor?: string;
}

/**
 * Traduce la clasificación del central al vocabulario de tonos del repo.
 *
 * No reimplementa la regla: el central ya decidió si está vencido, por vencer
 * o vigente. Acá solo se elige con qué color se dice.
 */
export function toneDeVencimiento(clase: string | undefined): 'danger' | 'warn' | 'ok' {
  if (!clase) {
    return 'ok';
  }
  if (clase.includes('vencido')) {
    return 'danger';
  }
  if (clase.includes('por-vencer')) {
    return 'warn';
  }
  return 'ok';
}
