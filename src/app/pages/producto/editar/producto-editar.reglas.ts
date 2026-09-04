import type { Producto, ProductoInput } from 'src/app/domains/productos/producto.model';

/**
 * Los campos que acepta `ProductoInput` del central.
 *
 * Es el contrato con `productos.graphqls`. `producto-input-completo.spec.ts`
 * verifica que `construirProductoInput` los emita todos y que
 * `productoPorIdQuery` los pida: sin las dos mitades, agregar un campo al
 * schema del central lo convierte en un borrado silencioso acá.
 */
export const CAMPOS_PRODUCTO_INPUT = [
  'id',
  'propagado',
  'descripcion',
  'descripcionFactura',
  'iva',
  'unidadPorCaja',
  'unidadPorCajaSecundaria',
  'balanza',
  'garantia',
  'tiempoGarantia',
  'ingrediente',
  'combo',
  'stock',
  'promocion',
  'vencimiento',
  'diasVencimiento',
  'cambiable',
  'usuarioId',
  'imagenes',
  'subfamiliaId',
  'tipoConservacion',
  'isEnvase',
  'envaseId',
  'activo',
  'lote',
] as const;

/**
 * Arma el input de `saveProducto` a partir del producto leído del central,
 * con `cambios` aplicado encima.
 *
 * ⚠️ **Nunca armes el input a mano.** `saveProducto` mapea el input a un
 * `Producto` nuevo y lo guarda (`ProductoService.java:297-325`): todo campo
 * ausente se persiste en `null`. Un input con solo `{id, descripcion}` apaga
 * el control de vencimiento, el de lote, el IVA y el flag `activo` — y la
 * mutation responde OK.
 *
 * `usuarioId` se deja fuera a propósito: lo completa `DatosService.guardar()`
 * con el usuario en sesión.
 */
export function construirProductoInput(
  producto: Producto,
  cambios: Partial<ProductoInput>,
): ProductoInput {
  const base: ProductoInput = {
    id: producto.id ?? null,
    propagado: producto.propagado ?? null,
    descripcion: producto.descripcion ?? null,
    descripcionFactura: producto.descripcionFactura ?? null,
    iva: producto.iva ?? null,
    unidadPorCaja: producto.unidadPorCaja ?? null,
    unidadPorCajaSecundaria: producto.unidadPorCajaSecundaria ?? null,
    balanza: producto.balanza ?? null,
    garantia: producto.garantia ?? null,
    tiempoGarantia: producto.tiempoGarantia ?? null,
    ingrediente: producto.ingrediente ?? null,
    combo: producto.combo ?? null,
    stock: producto.stock ?? null,
    promocion: producto.promocion ?? null,
    vencimiento: producto.vencimiento ?? null,
    diasVencimiento: producto.diasVencimiento ?? null,
    cambiable: producto.cambiable ?? null,
    usuarioId: null,
    imagenes: null,
    subfamiliaId: producto.subfamilia?.id ?? null,
    tipoConservacion: producto.tipoConservacion ?? null,
    isEnvase: producto.isEnvase ?? null,
    envaseId: producto.envase?.id ?? null,
    activo: producto.activo ?? null,
    lote: producto.lote ?? null,
  };

  // `undefined` explícito en `cambios` no debe pisar el valor hidratado: un
  // `{ descripcion: undefined }` armado desde un signal a medio llenar no es
  // lo mismo que "borrar la descripción". Filtrado, no un `??` por campo,
  // porque `cambios` puede traer cualquier subconjunto de los 25 campos.
  const cambiosDefinidos = Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined),
  );

  return { ...base, ...cambiosDefinidos };
}
