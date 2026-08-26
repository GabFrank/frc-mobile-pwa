import gql from 'graphql-tag';

const usuario = `
  id
  persona { nombre }
`;

const cabecera = `
  id
  sucursalOrigen { id nombre }
  sucursalDestino { id nombre }
  isOrigen
  isDestino
  tipo
  estado
  etapa
  observacion
  creadoEn
  usuarioPreTransferencia { ${usuario} }
  usuarioPreparacion { ${usuario} }
  usuarioTransporte { ${usuario} }
  usuarioRecepcion { ${usuario} }
`;

export const transferenciaPorIdQuery = gql`
  query ($id: ID!) {
    data: transferencia(id: $id) {
      ${cabecera}
    }
  }
`;

/**
 * ⚠️ Filtra por **`etapa`**, no por `estado` — son dos dimensiones distintas.
 * Pasar un valor de una donde va la otra devuelve una lista vacía sin error.
 */
export const transferenciasConFiltrosQuery = gql`
  query (
    $sucursalOrigenId: Int
    $sucursalDestinoId: Int
    $estado: TransferenciaEstado
    $tipo: TipoTransferencia
    $etapa: EtapaTransferencia
    $isOrigen: Boolean
    $isDestino: Boolean
    $creadoDesde: String
    $creadoHasta: String
    $page: Int
    $size: Int
  ) {
    data: transferenciasWithFilters(
      sucursalOrigenId: $sucursalOrigenId
      sucursalDestinoId: $sucursalDestinoId
      estado: $estado
      tipo: $tipo
      etapa: $etapa
      isOrigen: $isOrigen
      isDestino: $isDestino
      creadoDesde: $creadoDesde
      creadoHasta: $creadoHasta
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        ${cabecera}
      }
    }
  }
`;

/**
 * ⚠️ **Devuelve un `TransferenciaItemPage`, no una lista.** Los campos del
 * ítem viven dentro de `getContent`; pedirlos directamente sobre la página
 * hace que el central rechace la query entera con un `FieldUndefined` por
 * cada campo. `TransferenciaService.items()` desenvuelve el `getContent`.
 *
 * ⚠️ **`TransferenciaItem` no tiene `producto`.** El producto cuelga de la
 * presentación (`presentacionPreTransferencia.producto`); el servicio lo copia
 * a `item.producto` para que la vista lo siga leyendo de ahí.
 */
export const itemsPorTransferenciaQuery = gql`
  query ($id: ID!, $page: Int, $size: Int) {
    data: transferenciaItensPorTransferenciaId(id: $id, page: $page, size: $size) {
      getContent {
        id
        cantidadPreTransferencia
        presentacionPreTransferencia { id cantidad producto { id descripcion } }
        vencimientoPreTransferencia
        observacionPreTransferencia
        motivoRechazoPreTransferencia
        cantidadPreparacion
        presentacionPreparacion { id cantidad }
        observacionPreparacion
        motivoRechazoPreparacion
        cantidadTransporte
        presentacionTransporte { id cantidad }
        observacionTransporte
        motivoRechazoTransporte
        cantidadRecepcion
        presentacionRecepcion { id cantidad }
        observacionRecepcion
        motivoRechazoRecepcion
      }
    }
  }
`;

/**
 * ⚠️ **Es el único camino correcto para cambiar de etapa.** Guardar la
 * transferencia con la etapa modificada saltea las validaciones y los
 * movimientos de stock que el backend aplica en el avance.
 *
 * ⚠️ La mutation **no lleva alias `data:`** en el original y devuelve un
 * `Boolean` plano; acá se aliasea para que `DatosService` lo desenvuelva.
 */
export const avanzarEtapaMutation = gql`
  mutation avanzarEtapaTransferencia($id: ID!, $etapa: EtapaTransferencia!, $usuarioId: ID!) {
    data: avanzarEtapaTransferencia(id: $id, etapa: $etapa, usuarioId: $usuarioId)
  }
`;

export const finalizarTransferenciaMutation = gql`
  mutation finalizarTransferencia($id: ID!, $usuarioId: ID!) {
    data: finalizarTransferencia(id: $id, usuarioId: $usuarioId)
  }
`;
