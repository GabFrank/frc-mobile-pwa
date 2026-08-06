import gql from 'graphql-tag';

const cabecera = `
  id
  sucursal { id nombre }
  fechaInicio
  fechaFin
  abierto
  tipo
  estado
  observacion
  usuario { id persona { nombre } }
`;

export const inventarioPorIdQuery = gql`
  query ($id: ID!) {
    data: inventario(id: $id) {
      ${cabecera}
      inventarioProductoList {
        id
        concluido
        creadoEn
        usuario { id persona { nombre } }
        zona { id descripcion sector { id descripcion } }
        producto { id descripcion }
        inventarioProductoItemList {
          id
          cantidad
          cantidadFisica
          cantidadAnterior
          verificado
          revisado
          vencimiento
          estado
          copiedFromItemId
          presentacion { id cantidad }
        }
      }
    }
  }
`;

/** ⚠️ Los abiertos de una sucursal: consultarlos **antes** de crear uno nuevo. */
export const inventarioAbiertoPorSucursalQuery = gql`
  query ($id: ID!) {
    data: inventarioAbiertoPorSucursal(sucId: $id) {
      ${cabecera}
    }
  }
`;

export const inventariosPorUsuarioQuery = gql`
  query GetInventariosPorUsuarioPaginado(
    $usuarioId: ID!
    $page: Int!
    $size: Int!
    $sortOrder: String
  ) {
    data: getInventariosPorUsuarioPaginado(
      usuarioId: $usuarioId
      page: $page
      size: $size
      sortOrder: $sortOrder
    ) {
      getTotalElements
      getTotalPages
      hasNext
      getContent {
        ${cabecera}
      }
    }
  }
`;

/**
 * ⚠️ **Finalizar aplica las diferencias**: no es solo un cambio de estado.
 * Lo que quede sin contar entra como diferencia contra el sistema.
 */
export const finalizarInventarioMutation = gql`
  mutation finalizarInventario($id: ID!) {
    data: finalizarInventario(id: $id) {
      id
      estado
    }
  }
`;

export const cancelarInventarioMutation = gql`
  mutation cancelarInventario($id: ID!) {
    data: cancelarInventario(id: $id)
  }
`;

export const reabrirInventarioMutation = gql`
  mutation reabrirInventario($id: ID!) {
    data: reabrirInventario(id: $id)
  }
`;

export const saveInventarioProductoItemMutation = gql`
  mutation saveInventarioProductoItem($entity: InventarioProductoItemInput!) {
    data: saveInventarioProductoItem(entity: $entity) {
      id
      cantidad
      cantidadFisica
      verificado
      revisado
    }
  }
`;
