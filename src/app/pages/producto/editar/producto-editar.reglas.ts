import type { Codigo } from 'src/app/domains/productos/codigo.model';
import type { PrecioPorSucursal } from 'src/app/domains/productos/precio-por-sucursal.model';
import type { Presentacion } from 'src/app/domains/productos/presentacion.model';
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

/**
 * Un envase no tiene propiedades de mercadería.
 *
 * Marcar `isEnvase` apaga balanza, garantía, ingrediente, promoción,
 * vencimiento y lote. Lo hace el escritorio en `producto.component.ts:291-297`,
 * y no está escrito en ninguna documentación: una botella retornable no vence,
 * no se pesa y no lleva lote.
 *
 * ⚠️ **Son seis, no siete.** El escritorio apaga además `esAlcoholico`, que no
 * existe ni en `ProductoInput` ni en la entidad `Producto` del central: es un
 * control de su formulario que no viaja a ningún lado, como `observacion`. Y
 * **no** apaga `combo`, así que acá tampoco — apagarlo sería inventar una regla
 * de negocio que nadie escribió.
 */
export function aplicarCascadaEnvase(
  cambios: Partial<ProductoInput>,
): Partial<ProductoInput> {
  if (cambios.isEnvase !== true) {
    return cambios;
  }

  return {
    ...cambios,
    balanza: false,
    garantia: false,
    ingrediente: false,
    promocion: false,
    vencimiento: false,
    lote: false,
  };
}

/**
 * Lo que falta para poder guardar, o `null` si está todo.
 *
 * ⚠️ **La descripción no es opcional aunque el schema la declare `String`.**
 * `ProductoService.java:312` hace `e.getDescripcion().toUpperCase()` sin
 * guard: un input sin descripción no da un error de validación, tira un
 * `NullPointerException` en el central.
 */
export function faltaParaGuardarProducto(input: ProductoInput): string | null {
  if (input.descripcion == null || input.descripcion.trim() === '') {
    return 'La descripción es obligatoria';
  }
  return null;
}

/**
 * Los precios que hay que degradar para que quede uno solo principal.
 *
 * El escritorio lo hace en `adicionar-precio-dialog.component.ts:226-244`:
 * antes de guardar el nuevo principal, apaga el `principal` de los demás de
 * esa presentación. Sin esto quedan dos y cuál gana lo decide el orden en que
 * el central devuelva la lista, que no está garantizado.
 *
 * `nuevoPrincipalId` es `null` cuando el que se está marcando todavía no
 * existe en la base.
 */
export function preciosADegradar(
  precios: PrecioPorSucursal[],
  nuevoPrincipalId: number | null,
): PrecioPorSucursal[] {
  return precios.filter((p) => p.principal === true && p.id !== nuevoPrincipalId);
}

/**
 * La misma regla, para el código principal de una presentación.
 *
 * ⚠️ **Genérica a propósito.** `Codigo` es una clase con `toInput()`
 * obligatorio, pero lo que llega de GraphQL —y lo que arma un test— es un
 * objeto plano con estos dos campos, nunca una instancia real. Tipar el
 * parámetro como `Codigo[]` a secas rechazaba esos objetos aunque la regla
 * no mire nada más que `id` y `principal`.
 */
export function codigosADegradar<T extends { id?: number | null; principal?: boolean | null }>(
  codigos: T[],
  nuevoPrincipalId: number | null,
): T[] {
  return codigos.filter((c) => c.principal === true && c.id !== nuevoPrincipalId);
}

/**
 * La misma regla, para la presentación principal de un producto.
 *
 * ⚠️ **Sin dimensión de sucursal.** A diferencia de los precios, las
 * presentaciones de un producto son todas de ese producto: no hay que filtrar
 * por sucursal antes de degradar, como sí hace `preciosADegradar()`.
 *
 * Sin esto, marcar «Caja x12» como principal cuando «Unidad» ya lo era deja
 * dos presentaciones con `principal = true`, y `presentacionPorCodigo()`
 * (`presentacion.util.ts`) resuelve el empate por orden de lista, no por
 * ninguna regla de negocio: un código que no matchea ningún código propio
 * puede terminar cobrando el precio de la presentación equivocada.
 */
export function presentacionesADegradar(
  presentaciones: Presentacion[],
  nuevoPrincipalId: number | null,
): Presentacion[] {
  return presentaciones.filter((p) => p.principal === true && p.id !== nuevoPrincipalId);
}

/** `true` si el parámetro de ruta no es ni `valorEspecial` ni un id positivo. */
export function esIdDeRutaInvalido(raw: string | undefined, valorEspecial?: string): boolean {
  if (raw === undefined || raw === valorEspecial) {
    return false;
  }
  const n = Number(raw);
  // `Number('')` es 0, no NaN: sin el guard completo una ruta vacía se
  // leería como "id cero" en vez de como una ruta rota.
  return !Number.isFinite(n) || n <= 0;
}

/** El id numérico de un parámetro de ruta, o `null` si no es válido. */
export function idDeRutaNum(raw: string | undefined, valorEspecial?: string): number | null {
  if (raw === undefined || raw === valorEspecial) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
