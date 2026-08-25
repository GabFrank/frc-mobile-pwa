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

/**
 * ⚠️ **`InventarioProducto` agrupa por zona, no por producto.** El central
 * dejó de tener `producto_id` en esa tabla (migración `V61.1`) y la unicidad
 * quedó en `(inventario_id, zona_id)`. El producto de cada renglón sale de
 * `presentacion.producto`, que es de donde lo lee también `frc-mobile`.
 * Pedirlo sobre `InventarioProducto` hace que el central rechace la consulta
 * entera por validación y la pantalla no cargue.
 */
export const inventarioPorIdQuery = gql`
  query ($id: ID!) {
    data: inventario(id: $id) {
      ${cabecera}
      inventarioProductoList {
        id
        concluido
        usuario { id persona { nombre } }
        zona { id descripcion sector { id descripcion } }
        inventarioProductoItemList {
          id
          cantidad
          cantidadFisica
          cantidadAnterior
          verificado
          revisado
          vencimiento
          estado
          presentacion { id cantidad producto { id descripcion } }
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
    data: saveInventarioProductoItem(inventarioProductoItem: $entity) {
      id
      cantidad
      cantidadFisica
      verificado
      revisado
    }
  }
`;

/**
 * Control de inventario: los tres reportes de saldo.
 *
 * ⚠️ **`productosFaltantes` exige sucursal y rango de fechas**; los otros dos
 * no. No es un descuido del schema: un faltante solo tiene sentido dentro de
 * un período —«no se movió entre estas fechas»—, mientras que un saldo
 * positivo o negativo es un estado actual.
 */
export const productosConCantidadPositivaQuery = gql`
  query ($sucursalId: ID, $productoId: ID, $page: Int, $size: Int) {
    data: productosConCantidadPositiva(
      sucursalId: $sucursalId
      productoId: $productoId
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        productoId
        productoDescripcion
        sucursalId
        saldoTotal
      }
    }
  }
`;

export const productosConCantidadNegativaQuery = gql`
  query ($sucursalId: ID, $productoId: ID, $page: Int, $size: Int) {
    data: productosConCantidadNegativa(
      sucursalId: $sucursalId
      productoId: $productoId
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        productoId
        productoDescripcion
        sucursalId
        saldoTotal
      }
    }
  }
`;

export const productosFaltantesQuery = gql`
  query ($sucursalId: ID!, $productoId: ID, $fechaInicio: String!, $fechaFin: String!, $page: Int, $size: Int) {
    data: productosFaltantes(
      sucursalId: $sucursalId
      productoId: $productoId
      fechaInicio: $fechaInicio
      fechaFin: $fechaFin
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        productoId
        productoDescripcion
        sucursalId
        saldoTotal
      }
    }
  }
`;

/**
 * Los ítems de un inventario, para que un supervisor los revise.
 *
 * ⚠️ **`filtro` ordena, no filtra.** El central lo usa en un `ORDER BY CASE`
 * que pone primero a los que coinciden; los demás siguen viniendo detrás. Un
 * nombre como «solo modificados» sería mentira: la lista trae todos los ítems
 * del inventario en cualquier caso.
 *
 * Valores que el central reconoce: `cantidadExacta` y `modificado`. Cualquier
 * otra cosa (o `null`) deja el orden natural, por id descendente.
 */
export const itemsParaRevisarQuery = gql`
  query ($inventarioId: ID!, $filtro: String, $page: Int!, $size: Int!) {
    data: getInventarioItemsParaRevisar(
      inventarioId: $inventarioId
      filtro: $filtro
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        id
        cantidad
        cantidadFisica
        cantidadAnterior
        verificado
        revisado
        presentacion {
          id
          cantidad
          producto { id descripcion }
        }
      }
    }
  }
`;
