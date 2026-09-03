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
    $estados: [TransferenciaEstado]
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
      estados: $estados
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
        motivoModificacionPreTransferencia
        motivoRechazoPreTransferencia
        cantidadPreparacion
        presentacionPreparacion { id cantidad }
        vencimientoPreparacion
        observacionPreparacion
        motivoModificacionPreparacion
        motivoRechazoPreparacion
        cantidadTransporte
        presentacionTransporte { id cantidad }
        vencimientoTransporte
        observacionTransporte
        motivoModificacionTransporte
        motivoRechazoTransporte
        cantidadRecepcion
        presentacionRecepcion { id cantidad }
        vencimientoRecepcion
        observacionRecepcion
        motivoModificacionRecepcion
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

/**
 * Guarda un ítem. **Es un PATCH**: lo que el input no trae, el central lo
 * conserva de la fila existente.
 *
 * ⚠️ **Mandar `null` no borra.** `frc-mobile` desconfirma poniendo los
 * campos en `null` y guardando; contra este central eso no vacía nada y la
 * pantalla queda mostrando un estado que no se guardó. Para vaciar una
 * etapa está `desconfirmarTransferenciaItem`.
 *
 * ⚠️ **El input exige `usuarioId`** —la columna es `NOT NULL`— y lo completa
 * `DatosService.guardar()` con el usuario en sesión.
 */
export const saveTransferenciaItemMutation = gql`
  mutation saveTransferenciaItem($entity: TransferenciaItemInput!) {
    data: saveTransferenciaItem(transferenciaItem: $entity) {
      id
    }
  }
`;

/**
 * Vacía las columnas de **una** etapa del ítem y desactiva su movimiento de
 * stock. Es la única forma de deshacer una verificación: ver el aviso de
 * `saveTransferenciaItemMutation`.
 *
 * ⚠️ Solo acepta las tres etapas en las que se verifican ítems
 * (`PREPARACION_MERCADERIA`, `TRANSPORTE_VERIFICACION`,
 * `RECEPCION_EN_VERIFICACION`); con cualquier otra el central responde error.
 */
export const desconfirmarTransferenciaItemMutation = gql`
  mutation desconfirmarTransferenciaItem($id: ID!, $etapa: EtapaTransferencia!) {
    data: desconfirmarTransferenciaItem(id: $id, etapa: $etapa) {
      id
    }
  }
`;

/**
 * Alta y edición de la cabecera.
 *
 * ⚠️ **El responsable solo entra por `usuarioPreTransferenciaId`.** El
 * `usuarioId` genérico que completa `DatosService.guardar()` la cabecera no lo
 * mira: `saveTransferencia` asigna `usuarioPreTransferencia` únicamente cuando
 * el input trae ese campo, y si no lo trae conserva el que ya tenía la fila
 * —que en un alta es ninguno—.
 *
 * ⚠️ **También es un PATCH.** El central carga la fila existente para
 * preservar lo que el input no manda, y valida que la etapa no retroceda: un
 * input viejo con la etapa vieja sería un `save` que devuelve la
 * transferencia al principio.
 *
 * Devuelve la cabecera completa porque de `estado` y `etapa` depende adónde
 * navega la pantalla después de crear.
 */
export const saveTransferenciaMutation = gql`
  mutation saveTransferencia($entity: TransferenciaInput!) {
    data: saveTransferencia(transferencia: $entity) {
      ${cabecera}
    }
  }
`;

/**
 * Quita un ítem del borrador.
 *
 * Es un borrado real, no un `activo = false`: mientras la transferencia está
 * en creación el renglón todavía no significa nada para el stock.
 */
export const deleteTransferenciaItemMutation = gql`
  mutation deleteTransferenciaItem($id: ID!) {
    data: deleteTransferenciaItem(id: $id)
  }
`;
