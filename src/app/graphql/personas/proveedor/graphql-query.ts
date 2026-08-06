import { gql } from 'apollo-angular';

/**
 * Búsqueda de proveedores por nombre de la persona.
 *
 * Se pide solo lo que la recepción necesita —id y nombre—: el documento del
 * repo anterior arrastraba `vendedores`, `productos` y condiciones de
 * crédito en cada tecla del buscador.
 */
export const proveedoresPorTextoQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: proveedorSearchByPersonaPage(texto: $texto, page: $page, size: $size) {
      getTotalPages
      getTotalElements
      getNumberOfElements
      isFirst
      isLast
      hasNext
      hasPrevious
      getContent {
        id
        persona {
          id
          nombre
          documento
        }
      }
    }
  }
`;

/**
 * Un proveedor por id.
 *
 * Existe para las pantallas que reciben el id por la URL y necesitan mostrar
 * el nombre —la solicitud de pago abierta desde una recepción—. Pide lo
 * mismo que la búsqueda: nombrar al proveedor, nada más.
 */
export const proveedorPorIdQuery = gql`
  query ($id: ID!) {
    data: proveedor(id: $id) {
      id
      persona {
        id
        nombre
      }
    }
  }
`;
