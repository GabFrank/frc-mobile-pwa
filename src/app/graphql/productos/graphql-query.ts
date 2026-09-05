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
        nombre
        familia {
          id
          nombre
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

/**
 * Alta y edición de la cabecera del producto.
 *
 * ⚠️ **Reemplaza, no parchea.** El central mapea el input a un `Producto`
 * nuevo y lo guarda (`ProductoService.java:297-325`), así que todo campo
 * ausente se persiste en `null`. El input se arma con
 * `construirProductoInput()`, nunca a mano. Ver
 * `pages/producto/editar/producto-editar.reglas.ts`.
 *
 * ⚠️ **La descripción vuelve en mayúsculas**, porque el central la convierte
 * (`ProductoService.java:312`). La pantalla muestra lo que volvió, no lo que
 * se tipeó, o el operador ve una cosa y la base guarda otra.
 */
export const saveProductoMutation = gql`
  mutation saveProducto($entity: ProductoInput!) {
    data: saveProducto(producto: $entity) {
      id
      descripcion
    }
  }
`;

/** Alta y edición de una presentación. Cuelga del producto. */
export const savePresentacionMutation = gql`
  mutation savePresentacion($entity: PresentacionInput!) {
    data: savePresentacion(presentacion: $entity) {
      id
      descripcion
      cantidad
      principal
      activo
    }
  }
`;

export const deletePresentacionMutation = gql`
  mutation deletePresentacion($id: ID!) {
    data: deletePresentacion(id: $id)
  }
`;

/**
 * Alta y edición de un código.
 *
 * ⚠️ **El código cuelga de la PRESENTACIÓN, no del producto.** `CodigoInput`
 * lleva `presentacionId`: un mismo producto tiene códigos distintos para la
 * unidad y para la caja, y es el código el que determina qué precio y qué
 * cantidad corresponden.
 */
export const saveCodigoMutation = gql`
  mutation saveCodigo($entity: CodigoInput!) {
    data: saveCodigo(codigo: $entity) {
      id
      codigo
      principal
      activo
    }
  }
`;

export const deleteCodigoMutation = gql`
  mutation deleteCodigo($id: ID!) {
    data: deleteCodigo(id: $id)
  }
`;

/**
 * Alta y edición de un precio.
 *
 * ⚠️ **Un precio es la terna presentación × tipo de precio × sucursal**, y se
 * escribe **una** por llamada. La app escribe siempre en la sucursal de la
 * sesión, igual que el escritorio (`adicionar-precio-dialog.component.ts:265`
 * fija `sucursalId = sucursalActual.id` sin alternativa). Los precios de las
 * otras sucursales se muestran de solo lectura.
 */
export const savePrecioPorSucursalMutation = gql`
  mutation savePrecioPorSucursal($entity: PrecioPorSucursalInput!) {
    data: savePrecioPorSucursal(precioPorSucursal: $entity) {
      id
      precio
      principal
      activo
    }
  }
`;

export const deletePrecioPorSucursalMutation = gql`
  mutation deletePrecioPorSucursal($id: ID!) {
    data: deletePrecioPorSucursal(id: $id)
  }
`;

/**
 * El próximo EAN-13 interno: prefijo `2199` + secuencia + dígito verificador.
 *
 * **No lo persiste**: lo devuelve y lo guarda después `saveCodigo`. Es lo que
 * cierra el caso «producto sin código de fábrica» sin que nadie invente
 * números a mano.
 */
export const generarCodigoInternoQuery = gql`
  query {
    data: generarCodigoInterno
  }
`;

/** Familias, para el primer paso de la categoría. Devuelve una página. */
export const familiaSearchQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: familiaSearch(texto: $texto, page: $page, size: $size) {
      getContent {
        id
        nombre
      }
      hasNext
    }
  }
`;

/**
 * Subfamilias de una familia.
 *
 * ⚠️ **`familiaId` es obligatorio en la práctica.** Sin él la consulta
 * devuelve las subfamilias de todas las familias, que en esta base son cientos
 * y no significan nada fuera de su familia.
 */
export const subfamiliaSearchQuery = gql`
  query ($familiaId: ID, $texto: String, $page: Int, $size: Int) {
    data: subfamiliaSearch(familiaId: $familiaId, texto: $texto, page: $page, size: $size) {
      getContent {
        id
        nombre
        familia {
          id
          nombre
        }
      }
      hasNext
    }
  }
`;

/** Tipos de presentación: UNIDAD, CAJA, etc. Son pocos y no se paginan. */
export const tiposPresentacionQuery = gql`
  query ($page: Int, $size: Int) {
    data: tiposPresentacion(page: $page, size: $size) {
      id
      descripcion
    }
  }
`;

/** Tipos de precio: contado, crédito, mayorista. */
export const tipoPreciosQuery = gql`
  query ($page: Int, $size: Int) {
    data: tipoPrecios(page: $page, size: $size) {
      id
      descripcion
      activo
    }
  }
`;

/**
 * `true` si ya existe un producto con esa descripción exacta.
 *
 * Existe en el central desde siempre y no la usaba nadie. Sirve para avisar en
 * el alta, **no para bloquearla**: hay homónimos legítimos —el mismo artículo
 * en presentaciones que se cargan como productos distintos—, y un bloqueo duro
 * empuja al operador a inventar variantes del nombre para esquivarlo, que es
 * peor que el duplicado.
 *
 * ⚠️ **Compara exacto y el central guarda en mayúsculas**
 * (`ProductoService.java:312`). Mandar la descripción tal como se tipeó no
 * encuentra nada: hay que mandarla en mayúsculas, como va a quedar guardada.
 */
export const productoDescripcionExistsQuery = gql`
  query ($descripcion: String) {
    data: productoDescripcionExists(descripcion: $descripcion)
  }
`;
