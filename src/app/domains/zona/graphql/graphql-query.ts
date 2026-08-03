import gql from 'graphql-tag';

export const zonasQuery = gql`
  {
    data: zonas {
      id
      sector {
        id
        descripcion
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const zonasSearch = gql`
  query ($texto: String) {
    data: zonasSearch(texto: $texto) {
      id
      sector {
        id
        descripcion
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const zonaQuery = gql`
  query ($id: ID!) {
    data: zona(id: $id) {
      id
      sector {
        id
        descripcion
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const saveZona = gql`
  mutation saveZona($entity: ZonaInput!) {
    data: saveZona(zona: $entity) {
      id
      sector {
        id
        descripcion
      }
      descripcion
      activo
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const deleteZonaQuery = gql`
  mutation deleteZona($id: ID!) {
    deleteZona(id: $id)
  }
`;
