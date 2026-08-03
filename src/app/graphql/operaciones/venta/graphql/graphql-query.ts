import gql from "graphql-tag";

export const ventasQuery = gql`
    query ($sucId: ID){
    data: ventas (sucId: $sucId) {
      id
      sucursalId
      cliente {
        id
      }
      formaPago {
        id
        descripcion
      }
      estado
      creadoEn
      usuario {
        id
      }
      ventaItemList {
        id
        producto {
          id
        }
        cantidad
        precioCosto
        precioVenta {
          precio
        }
        precio
        valorDescuento
        unidadMedida
        creadoEn
        usuario {
          id
        }
        valorTotal
      }
      valorDescuento
      valorTotal
      totalGs
      totalRs
      totalDs
    }
  }
`;

export const ventaQuery = gql`
  query ($id: ID!, $sucId: ID) {
    data: venta(id: $id, sucId: $sucId) {
      id
      sucursalId
      cliente {
        id
      }
      formaPago {
        id
        descripcion
      }
      caja {
        id
      }
      estado
      creadoEn
      usuario {
        id
      }
      ventaItemList {
        id
        producto {
          id
          descripcion
          isEnvase
        }
        presentacion {
          cantidad
        }
        cantidad
        precioCosto
        precioVenta {
          precio
          tipoPrecio {
            descripcion
          }
        }
        precio
        valorDescuento
        unidadMedida
        creadoEn
        usuario {
          id
        }
        valorTotal
      }
      valorDescuento
      valorTotal
      totalGs
      totalRs
      totalDs
      cobro {
        id
        cobroDetalleList{
          id
          moneda {
            denominacion
          }
          valor
          cambio
          formaPago {
            descripcion
          }
          descuento
          aumento
          vuelto
          pago
          identificadorTransaccion
        }
      }
    }
  }
`;

export const saveVenta = gql`
  mutation saveVenta(
    $ventaInput: VentaInput!
    $ventaItemList: [VentaItemInput]
    $cobro: CobroInput
    $cobroDetalleList: [CobroDetalleInput]
    $ticket: Boolean
    $printerName: String
    $local: String,
    $pdvId: Int
    $ventaCreditoInput: VentaCreditoInput, 
    $ventaCreditoCuotaInputList: [VentaCreditoCuotaInput]
  ) {
    data: saveVenta(
      ventaInput: $ventaInput
      ventaItemList: $ventaItemList
      cobro: $cobro
      cobroDetalleList: $cobroDetalleList
      ticket: $ticket,
      printerName: $printerName,
      local: $local,
      pdvId: $pdvId,
      ventaCreditoInput: $ventaCreditoInput
      ventaCreditoCuotaInputList: $ventaCreditoCuotaInputList
    ){
      id
    }
  }
`;

export const deleteVentaQuery = gql`
  mutation deleteVenta($id: ID!, $sucId: ID) {
    deleteVenta(id: $id, sucId: $sucId)
  }
`;

export const cancelarVentaQuery = gql`
  mutation cancelarVenta($id: ID!, $sucId: ID) {
    data: cancelarVenta(id: $id, sucId: $sucId)
  }
`;

export const imprimirPagareQuery = gql`
  mutation imprimirPagare(
    $id: ID!,
    $itens: [VentaCreditoCuotaInput]!,
    $printerName: String,
    $local: String,
    $sucId: ID
    ) {
    data: imprimirPagare(
      id: $id
      itens: $itens
      printerName: $printerName,
      local: $local,
      sucId: $sucId
      )
  }
`;

export const reimprimirVentaQuery = gql`
  mutation reimprimirVenta(
    $id: ID!
    $printerName: String,
    $local: String,
    $sucId: ID
    ) {
    data: reimprimirVenta(
      id: $id
      printerName: $printerName,
      local: $local,
      sucId: $sucId
      )
  }
`;

//ventasPorCajaId

export const ventasPorCajaIdQuery = gql`
  query ($id: ID!, $page: Int, $size: Int, $asc: Boolean, $sucId: ID, $formaPago: ID, $estado: VentaEstado) {
    data: ventasPorCajaId(id: $id, page: $page,size: $size,asc: $asc, sucId: $sucId, formaPago: $formaPago, estado: $estado) {
      id
      sucursalId
      cliente {
        id
        persona {
          nombre
        }
      }
      formaPago {
        id
        descripcion
      }
      estado
      creadoEn
      usuario {
        id
      }
      valorDescuento
      valorTotal
      totalGs
      totalRs
      totalDs
    }
  }
`;

export const ventaPorPeriodoQuery = gql`
  query ($inicio: String, $fin: String, $sucId: ID) {
    data: ventaPorPeriodo(inicio: $inicio, fin: $fin, sucId: $sucId) {
      valorGs
      valorRs
      valorDs
      valorTotalGs
      creadoEn
    }
  }
`;

export const countVentaQuery = gql`
  {data: countVenta}
`

export const saveVentaItemQuery = gql`
  mutation saveVentaItem(
    $entity: VentaItemInput!
  ) {
    data: saveVentaItem(
      entity: $entity
    ){
      id
    }
  }
`;


export const saveCobroDetalleQuery = gql`
  mutation saveCobroDetalle(
    $entity: CobroDetalleInput!
  ) {
    data: saveCobroDetalle(
      entity: $entity
    ){
      id
    }
  }
`;

