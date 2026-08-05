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
