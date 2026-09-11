import gql from 'graphql-tag';

export const saveDevolucionMutation = gql`
  mutation saveDevolucion($entity: DevolucionInput!) {
    data: saveDevolucion(entity: $entity) {
      id
      tipo
      estado
      fecha
      motivo
      observacion
    }
  }
`;

export const saveDevolucionItemMutation = gql`
  mutation saveDevolucionItem($entity: DevolucionItemInput!) {
    data: saveDevolucionItem(entity: $entity) {
      id
      cantidad
      lote
      vencimiento
      motivo
    }
  }
`;

export const deleteDevolucionItemMutation = gql`
  mutation deleteDevolucionItem($id: ID!) {
    data: deleteDevolucionItem(id: $id)
  }
`;

/**
 * ⚠️ El enum se llama **`DevolucionEstado`** en el schema, aunque el enum del
 * cliente sea `EstadoDevolucion`. Los nombres están cruzados en el original y
 * no se corrigen acá: el que manda es el del backend.
 */
export const avanzarEstadoDevolucionMutation = gql`
  mutation avanzarEstadoDevolucion($devolucionId: ID!, $estado: DevolucionEstado!, $usuarioId: ID) {
    data: avanzarEstadoDevolucion(
      devolucionId: $devolucionId
      estado: $estado
      usuarioId: $usuarioId
    ) {
      id
      estado
    }
  }
`;

export const revertirEstadoDevolucionMutation = gql`
  mutation revertirEstadoDevolucion($devolucionId: ID!, $usuarioId: ID) {
    data: revertirEstadoDevolucion(devolucionId: $devolucionId, usuarioId: $usuarioId) {
      id
      estado
    }
  }
`;

export const devolucionByIdQuery = gql`
  query devolucion($id: ID!) {
    data: devolucion(id: $id) {
      id
      tipo
      estado
      identificador
      fecha
      motivo
      observacion
      sucursalOrigen {
        id
        nombre
      }
      sucursalUbicacion {
        id
        nombre
      }
      proveedor {
        id
        persona {
          nombre
          documento
        }
      }
      items {
        id
        cantidad
        lote
        vencimiento
        motivo
        producto {
          id
          descripcion
        }
        presentacion {
          id
          cantidad
        }
        motivoAveria {
          id
          descripcion
        }
      }
    }
  }
`;

export const devolucionConFiltrosQuery = gql`
  query devolucionConFiltros(
    $proveedorId: ID
    $sucursalId: ID
    $estado: DevolucionEstado
    $usuarioId: ID
    $page: Int
    $size: Int
  ) {
    data: devolucionConFiltros(
      proveedorId: $proveedorId
      sucursalId: $sucursalId
      estado: $estado
      usuarioId: $usuarioId
      page: $page
      size: $size
    ) {
      hasNext
      getTotalElements
      getContent {
        id
        tipo
        estado
        identificador
        fecha
        motivo
        colectadoEn
        sucursalOrigen {
          id
          nombre
        }
        sucursalUbicacion {
          id
          nombre
        }
        proveedor {
          id
          persona {
            nombre
          }
        }
      }
    }
  }
`;

export const motivosAveriaActivosQuery = gql`
  query motivosAveriaActivos {
    data: motivosAveriaActivos {
      id
      descripcion
      activo
      generaGasto
      aplicaProveedor
    }
  }
`;

/** Etiquetas de separado, en base64. Se imprimen al pasar a SEPARADO. */
export const etiquetasSeparadoPdfQuery = gql`
  query etiquetasSeparadoPdf($devolucionId: ID!) {
    data: etiquetasSeparadoPdf(devolucionId: $devolucionId)
  }
`;
