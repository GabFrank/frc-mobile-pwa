import { gql } from 'apollo-angular';

/**
 * Monedas del sistema.
 *
 * Sin `monedaBilleteList`: eso lo necesita el arqueo de caja, no la
 * recepción, y son decenas de filas por moneda.
 */
export const monedasQuery = gql`
  query {
    data: monedas {
      id
      denominacion
      simbolo
      cambio
    }
  }
`;
