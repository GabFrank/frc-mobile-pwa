import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { normalizarCodigo } from 'src/app/generic/utils/barcodeUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';

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

/**
 * Las presentaciones en las que se puede contar un inventario: las activas de
 * cantidad 1; si no hay, las demás activas; si ninguna está activa, ninguna.
 *
 * Existe para evitar el error de toque más caro del conteo: 100 unidades
 * cargadas en la «x6» se vuelven 600 al finalizar, porque el central suma
 * `cantidad × presentacion.cantidad`.
 *
 * ⚠️ **Una inactiva no se ofrece nunca.** Una lista vacía la pantalla la
 * muestra como alerta —el producto no tiene con qué contarse—, no como «no hay
 * nada»: ver `ProductoCardComponent`. Un `activo` ausente —la query que no lo
 * pide— cuenta como activo.
 *
 * ⚠️ **Un `cantidad` nulo no se ofrece**, ni como 1 —aunque
 * `etiquetaPresentacion()` lo muestre así— ni en el respaldo. El central multiplica con un `Double`
 * (`InventarioGraphQL.java:257`): un renglón en esa presentación hace fallar
 * la finalización de la toma entera.
 *
 * Caer en las demás activas es decisión de Franco (2026-09-21): bloquear dejaba
 * sin poder contar los productos que solo existen en caja.
 */
export function presentacionesContables(presentaciones: Presentacion[]): Presentacion[] {
  // Una `cantidad` nula tampoco vale en el respaldo: traba la finalización.
  const activas = presentaciones.filter((p) => p.activo !== false && p.cantidad != null);
  const unitarias = activas.filter((p) => p.cantidad === 1);
  return unitarias.length > 0 ? unitarias : activas;
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

/**
 * `Cantidad: 12 (Caja)` — la cantidad adelante.
 *
 * ⚠️ **El dato principal de una presentación es cuántas unidades trae**, no
 * cómo se llama. Es lo que decide el precio y lo que el operador compara
 * entre filas; la descripción es contexto. `frc-mobile` mostraba solo
 * `Presentación: {{cantidad}}`, sin nombre.
 *
 * La descripción sale de la presentación y, si no tiene, de su tipo. Si no
 * hay ninguna, no se inventa un paréntesis vacío.
 */
export function etiquetaPresentacion(presentacion: Presentacion): string {
  const cantidad = formatearCantidad(
    presentacion.cantidad ?? 1,
    Number.isInteger(presentacion.cantidad ?? 1) ? 0 : 2,
  );
  // `descripcion` está tipada como el wrapper `String` en los modelos
  // portados. No se tocan —los usan otras pantallas— y se normaliza acá.
  const crudo = presentacion.descripcion ?? presentacion.tipoPresentacion?.descripcion;
  const nombre = crudo != null ? String(crudo).trim() : '';
  return nombre ? `Cantidad: ${cantidad} (${nombre})` : `Cantidad: ${cantidad}`;
}
