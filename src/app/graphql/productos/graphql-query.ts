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
      lote
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
      lote
      cambiable
      imagenPrincipal
      codigoPrincipal
      isEnvase
    }
  }
`;

/**
 * Ficha del producto, y la fuente de hidratación de la edición.
 *
 * ⚠️ **Pide más campos de los que la ficha muestra, a propósito.** La edición
 * arma el `ProductoInput` desde este resultado, y `saveProducto` reemplaza la
 * fila en vez de parchearla: un campo que esta query no traiga se guarda en
 * `null` la próxima vez que alguien corrija una descripción. `iva`, `activo`,
 * `garantia` y `stock` están acá por eso, no porque se dibujen.
 *
 * `producto-input-completo.spec.ts` falla si el input acepta un campo que
 * esta query no pide.
 */
export const productoPorIdQuery = gql`
  query ($id: ID!) {
    data: producto(id: $id) {
      id
      propagado
      descripcion
      descripcionFactura
      iva
      unidadPorCaja
      unidadPorCajaSecundaria
      balanza
      garantia
      tiempoGarantia
      ingrediente
      combo
      stock
      promocion
      vencimiento
      diasVencimiento
      lote
      cambiable
      activo
      tipoConservacion
      imagenPrincipal
      codigoPrincipal
      isEnvase
      subfamilia {
        id
        descripcion
        familia {
          id
          descripcion
        }
      }
      envase {
        id
        descripcion
      }
      presentaciones {
        id
        descripcion
        activo
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
          sucursal {
            id
            nombre
          }
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

/**
 * Existencia en **todas** las sucursales, en una sola consulta.
 *
 * ⚠️ **Preferirla a llamar `productoPorSucursalStock` por sucursal.** Son 18
 * sucursales y el navegador abre 6 conexiones por origen: 18 requests salen
 * en tandas y ocupan todo el pool mientras duran, así que cualquier otra
 * consulta de la app hace cola detrás.
 *
 * Las sucursales sin movimientos **no vienen en la lista** — no hay filas que
 * sumar—, así que el llamador las muestra en cero.
 */
export const stockPorSucursalesQuery = gql`
  query ($proId: ID!) {
    data: stockPorSucursales(proId: $proId) {
      sucursalId
      cantidad
    }
  }
`;

/**
 * Reporte de productos vencidos y por vencer.
 *
 * ⚠️ **`fuenteVerdadList` es un enum del schema, no strings libres.** Mandar
 * una cadena que no esté en `FuenteVerdadVencimiento` hace que el central
 * rechace la operación entera, no ese filtro.
 *
 * Los campos de presentación —`diasVencimientoTexto`, `diasVencimientoClase`—
 * los calcula el central. Ver `producto-vencido.model.ts`.
 */
export const productosVencidosQuery = gql`
  query (
    $startDate: String
    $endDate: String
    $sucursalIdList: [Int]
    $productoIdList: [ID]
    $fuenteVerdadList: [FuenteVerdadVencimiento]
    $soloRealmenteVencidos: Boolean
    $page: Int
    $size: Int
  ) {
    data: productosVencidos(
      startDate: $startDate
      endDate: $endDate
      sucursalIdList: $sucursalIdList
      productoIdList: $productoIdList
      fuenteVerdadList: $fuenteVerdadList
      soloRealmenteVencidos: $soloRealmenteVencidos
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      getNumberOfElements
      isFirst
      isLast
      hasNext
      hasPrevious
      getPageable {
        getPageNumber
        getPageSize
      }
      getContent {
        id
        presentacionId
        presentacionCantidad
        productoId
        productoDescripcion
        codigoBarras
        cantidad
        vencimiento
        sucursalId
        sucursalNombre
        sectorDescripcion
        zonaDescripcion
        usuarioNickname
        fuenteVerdad
        detalleFuente
        referenciaInventario
        diasVencimiento
        diasVencimientoTexto
        diasVencimientoClase
      }
    }
  }
`;

/**
 * Los vencimientos que el central conoce de unas presentaciones.
 *
 * ⚠️ **No es `productosVencidos`, y la diferencia es el motivo de un bug.**
 * Ese reporte ancla las cinco fuentes al **último inventario** de la sucursal,
 * y la toma que se está contando **es** el último inventario: mientras se
 * cuenta devuelve cero, así que ningún renglón recibía sugerencia. Verificado
 * contra `bodega3`: COCA COLA 500ML tiene 81 fechas conocidas de su caja x 6 y
 * el reporte devolvía ninguna.
 *
 * Ésta no lleva ancla y ya viene recortada por el central: todas las vigentes
 * más las `maxVencidas` vencidas más recientes, por presentación.
 */
export const vencimientosConocidosQuery = gql`
  query ($sucursalId: ID!, $productoIdList: [ID], $maxVencidas: Int) {
    data: vencimientosConocidos(
      sucursalId: $sucursalId
      productoIdList: $productoIdList
      maxVencidas: $maxVencidas
    ) {
      id
      presentacionId
      productoId
      vencimiento
      fuenteVerdad
      detalleFuente
      diasVencimientoTexto
      diasVencimientoClase
    }
  }
`;
