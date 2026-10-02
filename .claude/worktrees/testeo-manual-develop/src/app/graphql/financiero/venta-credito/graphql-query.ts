import gql from 'graphql-tag';

export const ventaCreditosQuery = gql`
  {
    ventaCreditos {
      id
      sucursal {
        id
        nombre
      }
      venta {
        id
      }
      cliente {
        id
      }
      tipoConfirmacion
      cantidadCuotas
      valorTotal
      saldoTotal
      plazoEnDias
      interesPorDia
      interesMoraDia
      estado
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const ventaCreditoQuery = gql`
  query ($id: ID!) {
    data: ventaCredito(id: $id) {
      id
      sucursal {
        id
        nombre
      }
      venta {
        id
      }
      cliente {
        id
      }
      tipoConfirmacion
      cantidadCuotas
      valorTotal
      saldoTotal
      plazoEnDias
      interesPorDia
      interesMoraDia
      estado
      creadoEn
      usuario {
        id
      }
    }
  }
`;

export const ventaCreditoQrAuthQuery = gql`
  query ($id: ID!, $timestamp: String, $sucursalId: Int, $secretKey: String) {
    data: ventaCreditoQrAuth(
      id: $id
      timestamp: $timestamp
      sucursalId: $sucursalId
      secretKey: $secretKey
    )
  }
`;

export const ventaCreditoPorClienteQuery = gql`
  query ($id: ID!, $estado: EstadoVentaCredito) {
    data: ventaCreditoPorCliente(
      id: $id
      estado: $estado
    ) {
      id
      sucursal {
        id
        nombre
      }
      venta {
        id
        usuario {
          nickname
          persona {
            nombre
          }
        }
        sucursalId
      }
      cliente {
        id
      }
      tipoConfirmacion
      cantidadCuotas
      valorTotal
      saldoTotal
      plazoEnDias
      interesPorDia
      interesMoraDia
      estado
      creadoEn
      usuario {
        id
        nickname
      }
    }
  }
`;

export const ventaCreditoPorClientePageQuery = gql`
  query ($id: ID!, $estado: EstadoVentaCredito, $page: Int, $size: Int) {
    data: ventaCreditoPorClientePage(id: $id, estado: $estado, page: $page, size: $size) {
      getTotalPages
      getTotalElements
      getNumberOfElements
      isFirst
      isLast
      hasNext
      hasPrevious
      getContent {
        id
        sucursal {
          id
          nombre
        }
        venta {
          id
          usuario {
            nickname
            persona {
              nombre
            }
          }
          sucursalId
        }
        cliente {
          id
        }
        tipoConfirmacion
        cantidadCuotas
        valorTotal
        saldoTotal
        plazoEnDias
        interesPorDia
        interesMoraDia
        estado
        creadoEn
        usuario {
          id
          nickname
        }
      }
    }
  }
`;

export const saveVentaCredito = gql`
  mutation saveVentaCredito(
    $entity: VentaCreditoInput!
    $detalleList: [VentaCreditoCuotaInput]!
  ) {
    data: saveVentaCredito(entity: $entity, detalleList: $detalleList) {
      id
    }
  }
`;

export const deleteVentaCreditoQuery = gql`
  mutation deleteVentaCredito($id: ID!) {
    deleteVentaCredito(id: $id)
  }
`;

export const countByClienteAndEstado = gql`
  query ($id: ID!, $estado: EstadoVentaCredito) {
    data: countByClienteIdAndEstado(id: $id, estado: $estado)
  }
`;
