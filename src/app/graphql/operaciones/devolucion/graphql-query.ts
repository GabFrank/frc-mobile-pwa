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

/**
 * Devoluciones listas para retirar de un proveedor (SEPARADO o COLECTADO),
 * agrupadas por la sucursal donde están. Cada una trae sus productos: es lo
 * que se muestra al escanear su etiqueta. `sucursalId` null = todas.
 */
export const retiroProveedorConsolidadoQuery = gql`
  query retiroProveedorConsolidado($proveedorId: ID!, $sucursalId: ID) {
    data: retiroProveedorConsolidado(proveedorId: $proveedorId, sucursalId: $sucursalId) {
      proveedorId
      proveedorNombre
      grupos {
        sucursalId
        sucursalNombre
        devolucionIds
        devoluciones {
          devolucionId
          identificador
          estado
          productos {
            productoId
            descripcion
            cantidad
            presentacion
            lote
            vencimiento
          }
        }
      }
    }
  }
`;

/** Pasa a RETIRADO las devoluciones; un resultado por cada una, sin frenar las demás. */
export const retirarDevolucionesEnBloqueMutation = gql`
  mutation retirarDevolucionesEnBloque($devolucionIds: [ID!]!, $usuarioId: ID) {
    data: retirarDevolucionesEnBloque(devolucionIds: $devolucionIds, usuarioId: $usuarioId) {
      resultados {
        id
        ok
        mensaje
      }
    }
  }
`;

/** Comprobante de retiro (PDF en base64) de las devoluciones indicadas. */
export const remitoRetiroProveedorQuery = gql`
  query remitoRetiroProveedor($devolucionIds: [ID!]!) {
    data: remitoRetiroProveedor(devolucionIds: $devolucionIds)
  }
`;

/** Lo que el retiro necesita de la configuración del módulo. */
export const devolucionConfiguracionRetiroQuery = gql`
  query devolucionConfiguracionRetiro {
    data: devolucionConfiguracion {
      retiroPermitirSeleccionManual
    }
  }
`;
