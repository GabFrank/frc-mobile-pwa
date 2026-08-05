import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { normalizarCodigo } from 'src/app/generic/utils/barcodeUtils';

/**
 * Qué presentación corresponde a los códigos dados.
 *
 * ⚠️ **El código escaneado identifica la presentación, no solo el producto.**
 * Un mismo producto tiene un código para la unidad y otro para la caja, y de
 * eso dependen el precio y la cantidad. Resolver solo el producto y quedarse
 * con la primera presentación cobra mal las cajas.
 *
 * Si ningún código coincide, cae en la presentación principal: es lo que se
 * vende suelto, y es mejor que devolver nada.
 */
export function resolverPresentacionPorCodigo(
  producto: Producto,
  ...codigosReferencia: string[]
): Presentacion | null {
  const referencias = codigosReferencia.map(normalizarCodigo).filter((c) => c.length > 0);

  const presentaciones = producto?.presentaciones ?? [];
  if (presentaciones.length === 0) {
    return null;
  }

  const porCodigo = presentaciones.find((p) =>
    p.codigos?.some((c) => referencias.includes(normalizarCodigo(c.codigo ?? ''))),
  );
  if (porCodigo) {
    return porCodigo;
  }

  return presentaciones.find((p) => p.principal) ?? presentaciones[0] ?? null;
}

export function tienePresentaciones(producto: Producto): boolean {
  return (producto?.presentaciones?.length ?? 0) > 0;
}

/** Precio de la presentación: el principal, y si no el primero activo. */
export function precioDe(presentacion: Presentacion | null | undefined): number | null {
  if (!presentacion) {
    return null;
  }
  const principal = presentacion.precioPrincipal?.precio;
  if (principal != null) {
    return principal;
  }
  const activo = presentacion.precios?.find((p) => p.activo !== false && p.precio != null);
  return activo?.precio ?? null;
}

/** `Unidad`, `Caja x12`… para mostrar junto al precio. */
export function etiquetaPresentacion(presentacion: Presentacion): string {
  // `TipoPresentacion.descripcion` está tipado como el wrapper `String` en el
  // modelo portado. No se toca el modelo —lo usan otras pantallas— y se
  // normaliza acá.
  const tipo = String(presentacion.tipoPresentacion?.descripcion ?? 'Presentación');
  const cantidad = presentacion.cantidad ?? 1;
  return cantidad > 1 ? `${tipo} x${cantidad}` : tipo;
}
