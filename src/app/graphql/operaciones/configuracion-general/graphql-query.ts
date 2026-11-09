import { gql } from 'apollo-angular';

/** Solo el nombre: con eso se elige el logo de la empresa (farmacia o bodega). */
export const configuracionGeneralQuery = gql`
  query {
    data: configuracionGeneral {
      id
      nombreEmpresa
    }
  }
`;
