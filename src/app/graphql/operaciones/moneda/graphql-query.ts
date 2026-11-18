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

/**
 * Como `convertirPreciosQuery`, pero con los importes en `monedaOrigenId` en
 * vez de guaraníes (`null` = la moneda de la empresa, como la de arriba).
 *
 * ⚠️ Solo existe en un central con precios en otra moneda. Contra uno viejo
 * falla, y `ConversionPrecioService` vuelve a `convertirPreciosMobile`.
 */
export const convertirPreciosDesdeQuery = gql`
  query ($montos: [Float]!, $monedaOrigenId: ID) {
    data: convertirPreciosDesdeMobile(montos: $montos, monedaOrigenId: $monedaOrigenId) {
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

/**
 * Los precios que NO están en la moneda de la empresa, con su moneda: una
 * lista chica (vacía mientras todo esté en la moneda de la empresa).
 *
 * ⚠️ **Aparte a propósito.** `PrecioPorSucursal.moneda` solo existe en un
 * central con precios en otra moneda: pedirlo dentro de `productoPorIdQuery`
 * o de las búsquedas haría fallar todas esas consultas contra un central
 * viejo. Esta puede fallar sin consecuencias: quien la usa se comporta
 * entonces como siempre (todo en la moneda de la empresa). Se pide una vez
 * por sesión (`PrecioMonedaService`).
 */
export const preciosEnOtraMonedaQuery = gql`
  query {
    data: preciosEnOtraMoneda {
      precioId
      moneda {
        id
        denominacion
        simbolo
        decimales
      }
    }
  }
`;

/**
 * La moneda de **todos** los precios de un producto, activos o no (#137).
 * `preciosEnOtraMoneda` trae solo los activos, así que un precio inactivo en
 * otra moneda quedaba como de la moneda de la empresa. Va **aparte** de la
 * query del producto: contra un central sin `PrecioPorSucursal.moneda`
 * (anterior a V260.5) falla solo esta lectura, no la pantalla.
 */
export const monedaDePreciosDeProductoQuery = gql`
  query ($id: ID!) {
    data: producto(id: $id) {
      id
      presentaciones {
        id
        precios {
          id
          moneda {
            id
            denominacion
            simbolo
            decimales
          }
        }
      }
    }
  }
`;

