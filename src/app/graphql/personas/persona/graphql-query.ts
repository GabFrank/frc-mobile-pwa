import { gql } from 'apollo-angular';

/**
 * Búsqueda paginada de personas.
 *
 * Se pide solo lo que el buscador muestra: nombre para la fila y documento
 * para distinguir dos homónimos, que es el caso que hace elegir mal.
 */
export const personaSearchPageQuery = gql`
  query personaSearchPage($texto: String, $page: Int, $size: Int) {
    data: personaSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        nombre
        documento
      }
    }
  }
`;
