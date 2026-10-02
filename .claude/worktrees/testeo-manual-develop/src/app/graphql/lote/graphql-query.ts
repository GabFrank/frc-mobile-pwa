import { gql } from 'apollo-angular';

/**
 * Operaciones del control de lotes.
 *
 * ⚠️ **Todas aliasean su campo raíz a `data`.** Es la convención del repo: sin
 * el alias el resultado llega `undefined` sin error ni log.
 */

/**
 * Saldo por lote de un producto en una sucursal, ordenado por FEFO.
 *
 * ⚠️ **`cantidadDisponible` viene en unidades base**, no en la presentación
 * con la que cuenta el operador. La conversión la hace la pantalla, que es la
 * que sabe en qué presentación está el renglón.
 *
 * Puede incluir una fila sintética con `loteId` nulo y `numeroLote` «SIN LOTE»:
 * es el stock que existe en el agregado y no está atribuido a ningún lote. No
 * es un lote real y no se cuenta como tal.
 */
export const stockPorLoteQuery = gql`
  query ($productoId: ID!, $sucursalId: ID!) {
    data: stockPorLote(productoId: $productoId, sucursalId: $sucursalId) {
      loteId
      productoId
      numeroLote
      fechaVencimiento
      fechaRetiro
      estado
      cantidadDisponible
    }
  }
`;

/**
 * Buscador paginado de lotes de un producto.
 *
 * ⚠️ **Parte del MAESTRO, no del saldo**: incluye los lotes con saldo cero en
 * esa sucursal, que son exactamente los que hacen falta para atribuir
 * mercadería que está en la góndola sin lote. `texto` filtra por número de lote
 * por coincidencia parcial y el central lo normaliza igual que al crearlo, así
 * que buscar «l-20» encuentra «L-2026-88».
 */
export const buscarLotesDeProductoQuery = gql`
  query ($productoId: ID!, $sucursalId: ID, $texto: String, $page: Int, $size: Int) {
    data: buscarLotesDeProducto(
      productoId: $productoId
      sucursalId: $sucursalId
      texto: $texto
      page: $page
      size: $size
    ) {
      getTotalElements
      getTotalPages
      hasNext
      getContent {
        loteId
        numeroLote
        fechaVencimiento
        fechaRetiro
        estado
        saldo
        saldoTotal
      }
    }
  }
`;

/**
 * Alta manual de un lote, **sin mover stock**.
 *
 * ⚠️ **El lote nace con saldo cero.** La existencia se la pone después el
 * conteo al finalizar la toma: crear el maestro es registrar que el lote
 * existe, no decir cuánto hay.
 *
 * ⚠️ **Si el número ya existe para ese producto, el central devuelve el
 * existente en vez de fallar.** La unicidad es `(producto, número)` y ese lote
 * ES el que el operador tiene en la mano.
 */
export const crearLoteMutation = gql`
  mutation (
    $productoId: ID!
    $numeroLote: String!
    $fechaVencimiento: String
    $fechaRetiro: String
    $observacion: String
    $usuarioId: ID
  ) {
    data: crearLote(
      productoId: $productoId
      numeroLote: $numeroLote
      fechaVencimiento: $fechaVencimiento
      fechaRetiro: $fechaRetiro
      observacion: $observacion
      usuarioId: $usuarioId
    ) {
      id
      numeroLote
      fechaVencimiento
      fechaRetiro
      estado
    }
  }
`;

/**
 * Carga o corrige las fechas del maestro de un lote.
 *
 * ⚠️ **El cambio es global.** El maestro es uno por `(producto, número)` y
 * replica a todas las sucursales, así que esto reordena el FEFO en la red
 * entera. La pantalla que la llama tiene que haberlo dicho.
 *
 * ⚠️ **Un nulo no borra.** El input no puede distinguir «no lo mandé» de
 * «borralo», y borrar un vencimiento no es un caso real. Para dejar una fecha
 * sin tocar, no la mandes.
 */
export const actualizarFechasLoteMutation = gql`
  mutation (
    $loteId: ID!
    $fechaVencimiento: String
    $fechaRetiro: String
    $motivo: String
    $usuarioId: ID
  ) {
    data: actualizarFechasLote(
      loteId: $loteId
      fechaVencimiento: $fechaVencimiento
      fechaRetiro: $fechaRetiro
      motivo: $motivo
      usuarioId: $usuarioId
    ) {
      id
      numeroLote
      fechaVencimiento
      fechaRetiro
      estado
    }
  }
`;
