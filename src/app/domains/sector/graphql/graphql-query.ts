import gql from 'graphql-tag';

export const sectoresQuery = gql`
  query ($id: ID!) {
    data: sectores(id: $id) {
      id
      sucursal {
        id
        nombre
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
      zonaList {
        id
        descripcion
        activo
      }
    }
  }
`;

export const sectoresSearch = gql`
  query ($texto: String) {
    data: sectoresSearch(texto: $texto) {
      id
      sucursal {
        id
        nombre
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
      zonaList {
        id
        descripcion
        activo
      }
    }
  }
`;

export const sectorQuery = gql`
  query ($id: ID!) {
    data: sector(id: $id) {
      id
      sucursal {
        id
        nombre
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
      zonaList {
        id
        descripcion
        activo
      }
    }
  }
`;

export const saveSector = gql`
  mutation saveSector($entity: SectorInput!) {
    data: saveSector(sector: $entity) {
      id
      sucursal {
        id
        nombre
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
      zonaList {
        id
        descripcion
        activo
      }
    }
  }
`;

/**
 * ⚠️ **El alias `data:` también va en las mutaciones que devuelven un
 * booleano.** `DatosService.eliminar` lee `data`, así que sin el alias la
 * baja se ejecutaba en el central y la app la reportaba como fallida —
 * el peor de los dos mundos.
 */
export const deleteSectorQuery = gql`
  mutation deleteSector($id: ID!) {
    data: deleteSector(id: $id)
  }
`;
