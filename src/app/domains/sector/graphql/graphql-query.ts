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
      }
    }
  }
`;

export const deleteSectorQuery = gql`
  mutation deleteSector($id: ID!) {
    deleteSector(id: $id)
  }
`;
