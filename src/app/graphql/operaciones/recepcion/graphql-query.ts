import { gql } from 'apollo-angular';

/**
 * Recepción de mercadería. Portadas de
 * `frc-mobile/src/app/pages/operaciones/pedidos/`.
 *
 * ⚠️ **`verificarProductoMobile` lleva el sufijo a propósito.** El desktop
 * tiene su propio camino de verificación y no se toca. Ver
 * `docs/REGLAS_DESARROLLO.md`.
 */

export const recepcionesConFiltrosQuery = gql`
  query ($usuarioId: ID, $page: Int, $size: Int) {
    data: recepcionMercaderiaConFiltros(usuarioId: $usuarioId, page: $page, size: $size) {
      getTotalPages
      getTotalElements
      getNumberOfElements
      isFirst
      isLast
      hasNext
      hasPrevious
      getContent {
        id
        proveedor {
          id
          persona {
            nombre
          }
        }
        sucursalRecepcion {
          id
          nombre
        }
        fecha
        estado
        usuario {
          id
          persona {
            nombre
          }
        }
        notas {
          id
        }
      }
    }
  }
`;

export const recepcionPorIdQuery = gql`
  query ($id: ID!) {
    data: recepcionMercaderia(id: $id) {
      id
      proveedor {
        id
        persona {
          nombre
        }
      }
      sucursalRecepcion {
        id
        nombre
      }
      fecha
      estado
      usuario {
        id
        persona {
          nombre
        }
      }
      notas {
        id
      }
    }
  }
`;

export const productosPorRecepcionQuery = gql`
  query ($recepcionMercaderiaId: ID!, $estado: PedidoRecepcionProductoEstado, $page: Int, $size: Int) {
    data: pedidoRecepcionProductoPorRecepcionMercaderia(
      recepcionMercaderiaId: $recepcionMercaderiaId
      estado: $estado
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
      getContent {
        producto {
          id
          descripcion
          presentaciones {
            id
            cantidad
            descripcion
          }
        }
        totalCantidadARecibirPorUnidad
        totalCantidadRecibidaPorUnidad
        totalCantidadRechazadaPorUnidad
        cantidadPendientePorUnidad
        mostrarEnUnidadBase
        presentacionInicialSugerida {
          id
          cantidad
          descripcion
        }
        cantidadInicialPorPresentacion
        estado
      }
    }
  }
`;

export const productoPorRecepcionYProductoQuery = gql`
  query ($recepcionMercaderiaId: ID!, $productoId: ID!, $estado: PedidoRecepcionProductoEstado) {
    data: pedidoRecepcionProductoPorRecepcionMercaderiaAndProducto(
      recepcionMercaderiaId: $recepcionMercaderiaId
      productoId: $productoId
      estado: $estado
    ) {
      producto {
        id
        descripcion
        presentaciones {
          id
          cantidad
          descripcion
        }
      }
      totalCantidadARecibirPorUnidad
      totalCantidadRecibidaPorUnidad
      totalCantidadRechazadaPorUnidad
      cantidadPendientePorUnidad
      mostrarEnUnidadBase
      presentacionInicialSugerida {
        id
        cantidad
        descripcion
      }
      cantidadInicialPorPresentacion
      estado
    }
  }
`;

export const notaItemsPorNotaQuery = gql`
  query ($id: ID!) {
    data: notaRecepcionItemListPorNotaRecepcionId(id: $id) {
      id
      producto {
        id
        descripcion
      }
      notaRecepcion {
        id
        numero
      }
      cantidadEnNota
      cantidadRecibida
      cantidadRechazada
      cantidadPendiente
    }
  }
`;

export const recepcionActivaPorNotaYSucursalQuery = gql`
  query ($notaRecepcionId: ID!, $sucursalRecepcionId: ID!) {
    data: verificarRecepcionActivaPorNotaYSucursal(
      notaRecepcionId: $notaRecepcionId
      sucursalRecepcionId: $sucursalRecepcionId
    ) {
      id
      estado
      sucursalRecepcion {
        id
        nombre
      }
    }
  }
`;

export const constanciaRecepcionPdfQuery = gql`
  query ($recepcionId: ID!) {
    data: generarConstanciaRecepcionPDF(recepcionId: $recepcionId) {
      pdfBase64
      nombreArchivo
      tamanioBytes
      fechaGeneracion
    }
  }
`;

export const notasPorProveedorYNumeroQuery = gql`
  query ($id: ID!, $numero: Int!, $sucursalId: ID) {
    data: findByProveedorAndNumero(id: $id, numero: $numero, sucursalId: $sucursalId) {
      id
      pedido {
        id
      }
      compra {
        id
      }
      documento {
        id
        descripcion
      }
      valorTotal
      pagado
      numero
      fecha
      timbrado
      tipoBoleta
      estado
      moneda {
        id
        denominacion
        simbolo
      }
      cotizacion
      usuario {
        id
      }
    }
  }
`;

export const iniciarRecepcionMutation = gql`
  mutation iniciarRecepcion(
    $sucursalId: ID!
    $notaRecepcionIds: [ID!]!
    $proveedorId: ID!
    $monedaId: ID!
    $usuarioId: ID!
    $cotizacion: Float
  ) {
    data: iniciarRecepcion(
      sucursalId: $sucursalId
      notaRecepcionIds: $notaRecepcionIds
      proveedorId: $proveedorId
      monedaId: $monedaId
      usuarioId: $usuarioId
      cotizacion: $cotizacion
    ) {
      id
      estado
      sucursalRecepcion {
        id
        nombre
      }
      notas {
        id
      }
    }
  }
`;

export const verificarProductoMutation = gql`
  mutation verificarProductoMobile(
    $recepcionMercaderiaId: ID!
    $productoId: ID!
    $cantidadRecibida: Float!
    $cantidadRechazada: Float
    $notaRecepcionItemIdParaRechazo: ID
    $motivoRechazo: String
    $metodoVerificacion: String
    $usuarioId: ID!
  ) {
    data: verificarProductoMobile(
      recepcionMercaderiaId: $recepcionMercaderiaId
      productoId: $productoId
      cantidadRecibida: $cantidadRecibida
      cantidadRechazada: $cantidadRechazada
      notaRecepcionItemIdParaRechazo: $notaRecepcionItemIdParaRechazo
      motivoRechazo: $motivoRechazo
      metodoVerificacion: $metodoVerificacion
      usuarioId: $usuarioId
    )
  }
`;

export const deshacerVerificacionMutation = gql`
  mutation deshacerVerificacionPorProducto($recepcionMercaderiaId: ID!, $productoId: ID!) {
    data: deshacerVerificacionPorProducto(
      recepcionMercaderiaId: $recepcionMercaderiaId
      productoId: $productoId
    )
  }
`;

export const finalizarRecepcionMutation = gql`
  mutation finalizarRecepcionMercaderia($recepcionId: ID!, $rechazoPendientes: RechazoPendientesInput) {
    data: finalizarRecepcionMercaderia(recepcionId: $recepcionId, rechazoPendientes: $rechazoPendientes) {
      id
      estado
      fecha
      sucursalRecepcion {
        id
        nombre
      }
    }
  }
`;

export const reabrirRecepcionMutation = gql`
  mutation reabrirRecepcionMercaderia($recepcionId: ID!) {
    data: reabrirRecepcionMercaderia(recepcionId: $recepcionId) {
      id
      estado
      fecha
      sucursalRecepcion {
        id
        nombre
      }
    }
  }
`;
