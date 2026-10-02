import { gql } from 'apollo-angular';

/**
 * Lotes ya registrados de un producto, ordenados por FEFO.
 *
 * Incluye bloqueados y en cuarentena a propósito: si el operador está por
 * recibir uno de esos, hay que avisarle, no esconderlo.
 *
 * Es la misma operación que consume el desktop en la verificación detallada.
 * Es de solo lectura, así que no lleva método paralelo `Mobile`.
 */
export const lotesPorProductoQuery = gql`
  query ($productoId: ID!) {
    data: lotesPorProducto(productoId: $productoId) {
      id
      numeroLote
      fechaVencimiento
      fechaRetiro
      estado
    }
  }
`;
