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

/**
 * Importes en guaraníes expresados en cada moneda activa con cotización.
 *
 * **La conversión la hace el central**, con la última cotización y los
 * decimales de la moneda (regla 6). `montos` vuelve en el mismo orden que
 * `montosGs`. Con `montosGs: []` sirve para saber qué monedas hay.
 *
 * ⚠️ Necesita un central con `convertirPreciosMobile`. Contra uno viejo la
 * query falla, y el kiosco se queda en guaraníes sin selector.
 */
export const convertirPreciosQuery = gql`
  query ($montosGs: [Float]!) {
    data: convertirPreciosMobile(montosGs: $montosGs) {
      moneda {
        id
        denominacion
        simbolo
      }
      decimales
      montos
    }
  }
`;
