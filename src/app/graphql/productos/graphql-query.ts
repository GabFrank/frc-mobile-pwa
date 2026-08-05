import gql from 'graphql-tag';

/**
 * Producto por código.
 *
 * ⚠️ **No llamarla con el texto crudo del escáner.** Un escaneo produce
 * varios códigos candidatos —el GS1 trae el GTIN embebido, un EAN-14 con cero
 * inicial equivale a su EAN-13— y hay que probarlos en orden. De eso se ocupa
 * `ProductoBusquedaService`; esta operación resuelve **un** código.
 *
 * Trae las presentaciones con sus códigos y precios porque el código
 * escaneado identifica la **presentación**, no solo el producto: un mismo
 * producto tiene códigos distintos para la unidad y para la caja, y eso es lo
 * que determina el precio.
 */
export const productoPorCodigoQuery = gql`
  query ($texto: String) {
    data: productoPorCodigo(texto: $texto) {
      id
      descripcion
      balanza
      vencimiento
      diasVencimiento
      cambiable
      imagenPrincipal
      isEnvase
      codigoPrincipal
      envase {
        id
        descripcion
      }
      presentaciones {
        id
        principal
        cantidad
        codigos {
          id
          codigo
          principal
          activo
        }
        tipoPresentacion {
          id
          descripcion
        }
        precioPrincipal {
          id
          precio
        }
        precios {
          id
          precio
          principal
          activo
          tipoPrecio {
            id
            descripcion
          }
        }
      }
    }
  }
`;

/** Búsqueda por descripción. `offset` pagina de a lotes del backend. */
export const productoSearchQuery = gql`
  query ($texto: String, $offset: Int) {
    data: productoSearch(texto: $texto, offset: $offset) {
      id
      descripcion
      balanza
      vencimiento
      cambiable
      imagenPrincipal
      codigoPrincipal
      isEnvase
    }
  }
`;

/** Detalle completo, para cuando la búsqueda por texto no trae presentaciones. */
export const productoPorIdQuery = gql`
  query ($id: ID!) {
    data: producto(id: $id) {
      id
      descripcion
      balanza
      vencimiento
      diasVencimiento
      cambiable
      imagenPrincipal
      isEnvase
      codigoPrincipal
      envase {
        id
        descripcion
      }
      presentaciones {
        id
        principal
        cantidad
        codigos {
          id
          codigo
          principal
          activo
        }
        tipoPresentacion {
          id
          descripcion
        }
        precioPrincipal {
          id
          precio
        }
        precios {
          id
          precio
          principal
          activo
          tipoPrecio {
            id
            descripcion
          }
        }
      }
    }
  }
`;

/**
 * Código exacto → presentación y producto.
 *
 * Es el segundo intento para los pesables: el código de balanza lleva un
 * **código interno de 5 dígitos** que no es el código del producto, así que
 * `productoPorCodigo` no lo encuentra y hay que buscar por el código en sí.
 */
export const codigoPorCodigoQuery = gql`
  query ($texto: String) {
    data: codigoPorCodigo(texto: $texto) {
      id
      activo
      principal
      codigo
      presentacion {
        id
        cantidad
        activo
        precioPrincipal {
          id
          precio
        }
        producto {
          id
          descripcion
          balanza
        }
      }
    }
  }
`;

/** Existencia del producto en una sucursal. */
export const productoStockQuery = gql`
  query ($proId: ID!, $sucId: ID!) {
    data: productoPorSucursalStock(proId: $proId, sucId: $sucId)
  }
`;
