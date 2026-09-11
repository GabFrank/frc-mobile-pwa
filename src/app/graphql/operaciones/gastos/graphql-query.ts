import gql from 'graphql-tag';

const preGastoCampos = `
  id
  sucursalId
  descripcion
  estado
  estadoRendicion
  estadoEtiqueta
  estadoColor
  estadoIcono
  montoSolicitado
  montoRetirado
  montoGastado
  saldoDevolver
  qrToken
  retiroConfirmadoEn
  cajaId
  creadoEn
  funcionario { id nombre }
  tipoGasto { id descripcion moduloPadre }
  moneda { id simbolo denominacion }
  sucursalCaja { id nombre }
  finanzas { monto moneda { simbolo denominacion } }
  gasto {
    retiroGs
    retiroRs
    retiroDs
    vueltoGs
    vueltoRs
    vueltoDs
  }
`;

/** ⚠️ Se resuelve por id **y** sucursal: sin `sucId` no encuentra nada. */
export const preGastoPorIdQuery = gql`
  query preGasto($id: ID!, $sucId: ID) {
    data: preGasto(id: $id, sucId: $sucId) {
      ${preGastoCampos}
      rendiciones {
        id
        montoTotal
        fotosFacturaUrls
        fotosProductoUrls
        kmActual
        litros
        precioPorLitro
        ubicacionProvisoria
        establecimientoAlimentacion
        creadoEn
        tipoGasto { id descripcion }
      }
    }
  }
`;

export const filterPreGastosQuery = gql`
  query filterPreGastos(
    $id: ID
    $cajaId: ID
    $estado: String
    $estados: [String]
    $inicio: String
    $fin: String
    $page: Int
    $size: Int
  ) {
    data: filterPreGastos(
      id: $id
      cajaId: $cajaId
      estado: $estado
      estados: $estados
      inicio: $inicio
      fin: $fin
      page: $page
      size: $size
    ) {
      getTotalPages
      getTotalElements
      hasNext
      getContent {
        ${preGastoCampos}
      }
    }
  }
`;

/** ⚠️ La mutation se llama `...PreGasto` aunque el input no lo diga. */
export const confirmarRetiroMutation = gql`
  mutation confirmarRetiroFuncionarioPreGasto($input: ConfirmarRetiroFuncionarioInput!) {
    data: confirmarRetiroFuncionarioPreGasto(input: $input) {
      id
      sucursalId
      estado
      retiroConfirmadoEn
    }
  }
`;

/**
 * Rendición del gasto.
 *
 * ⚠️ **`montoTotal` es un solo `Float` y no lleva moneda.** Es la razón por
 * la que la pantalla pide un importe y no una lista: `frc-mobile` ofrecía
 * varias filas con su moneda cada una, pero al guardar mandaba **solo la de
 * guaraníes** —y si no había ninguna, la suma cruda de monedas distintas—.
 * Lo que el operador cargaba en dólares se perdía sin aviso.
 */
export const saveGastoRendicionMutation = gql`
  mutation saveGastoRendicion($input: GastoRendicionInput!) {
    data: saveGastoRendicion(input: $input) {
      id
      montoTotal
      creadoEn
    }
  }
`;

/** Catálogo de tipos de gasto, para el selector del alta. */
export const tipoGastosQuery = gql`
  query tipoGastos($page: Int, $size: Int) {
    data: tipoGastos(page: $page, size: $size) {
      id
      descripcion
      activo
      autorizacion
      moduloPadre
      tipoNaturaleza
      esPagoCuotaActivo
    }
  }
`;

/** Alta de la solicitud de caja chica. */
export const savePreGastoMutation = gql`
  mutation savePreGasto($entity: PreGastoInput!) {
    data: savePreGasto(entity: $entity) {
      id
      sucursalId
    }
  }
`;

/** Busca el `Ente` financiero ya creado para un activo, si existe. */
export const enteByReferenciaIdQuery = gql`
  query enteByReferenciaId($tipoEnte: TipoEnte!, $referenciaId: ID!) {
    data: enteByReferenciaId(tipoEnte: $tipoEnte, referenciaId: $referenciaId) {
      id
      tipoEnte
      referenciaId
      descripcion
      activo
    }
  }
`;

/** Crea el `Ente` financiero la primera vez que se le imputa un gasto. */
export const saveEnteMutation = gql`
  mutation saveEnte($ente: EnteInput!) {
    data: saveEnte(ente: $ente) {
      id
      tipoEnte
      referenciaId
      descripcion
      activo
    }
  }
`;

/**
 * Deuda y sugerencias de un activo.
 *
 * ⚠️ El campo se llama `getEnteFinancialSummary`, con el `get`; el alias
 * `data` es el que evita arrastrar ese nombre a la pantalla.
 */
export const enteFinancialSummaryQuery = gql`
  query enteFinancialSummary($enteId: ID!, $tipoGastoId: ID) {
    data: getEnteFinancialSummary(enteId: $enteId, tipoGastoId: $tipoGastoId) {
      enteId
      descripcion
      montoTotal
      montoYaPagado
      montoPendiente
      cuotasTotales
      cuotasPagadas
      cuotasFaltantes
      diaVencimiento
      diasParaVencer
      estadoCuota
      monedaSimbolo
      monedaId
      proveedorNombre
      proveedorId
      situacionPago
      porcentajePagado
      montoSugerido
      descripcionSugerida
      autocompletarMonto
      numeroCuotaActual
      fechaVencimientoSugerida
    }
  }
`;

export const vehiculoSearchPageQuery = gql`
  query vehiculoSearchPage($texto: String, $page: Int, $size: Int) {
    data: vehiculoSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        chapa
        modelo {
          descripcion
          marca { descripcion }
        }
      }
    }
  }
`;

export const muebleSearchPageQuery = gql`
  query muebleSearchPage($texto: String, $page: Int, $size: Int) {
    data: muebleSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent { id descripcion }
    }
  }
`;

export const inmuebleSearchPageQuery = gql`
  query inmuebleSearchPage($texto: String, $page: Int, $size: Int) {
    data: inmuebleSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent { id nombreAsignado }
    }
  }
`;

/** ⚠️ El backend expone `EquipoOutput`; para el buscador el campo es el mismo. */
export const equipoSearchPageQuery = gql`
  query equipoSearchPage($texto: String, $page: Int, $size: Int) {
    data: equipoSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        identificador
        descripcion
        modelo {
          descripcion
          marca { descripcion }
        }
      }
    }
  }
`;
