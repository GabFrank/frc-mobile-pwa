import gql from "graphql-tag";

export const cajasQuery = gql`
  query($page:Int, $size:Int, $sucId:ID){
    data: cajas(page:$page, size:$size, sucId:$sucId) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
    }
  }
`;

export const cajasPorUsuarioIdQuery = gql`
  query($id:ID!, $page:Int, $size:Int){
    data: cajasPorUsuarioId(id: $id, page:$page, size:$size) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      sucursal {
        id
        nombre
      }
    }
  }
`;

export const cajasPorFecha = gql`
  query ($inicio: String, $fin: String, $sucId:ID) {
    data: cajasPorFecha(inicio: $inicio, fin: $fin, sucId:$sucId) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
    }
  }
`;

export const balancePorFecha = gql`
  query ($inicio: String, $fin: String,$sucId:ID) {
    data: balancePorFecha(inicio: $inicio, fin: $fin, sucId:$sucId) {
      totalVentaGs
      totalVentaRs
      totalVentaDs
      totalTarjeta
    }
  }
`;

// export const cajasSearch = gql`
//   query ($texto: String) {
//     cajas: cajasSearch(texto: $texto) {
//       id
//       responsable {
//         id
//         persona {
//           id
//           nombre
//         }
//       }
//       tipoCaja {
//         id
//         descripcion
//         autorizacion
//       }
//       autorizadoPor {
//         id
//         persona {
//           id
//           nombre
//         }
//       }
//       observacion
//       creadoEn
//       usuario {
//         id
//         persona {
//           id
//           nombre
//         }
//       }
//       cajaDetalleList {
//         id
//         moneda {
//           id
//           denominacion
//         }
//         cambio {
//           id
//           valorEnGs
//         }
//         cantidad
//       }
//     }
//   }
// `;

export const cajaQuery = gql`
  query ($id: ID!, $sucId:ID) {
    data: pdvCaja(id: $id, sucId:$sucId) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      balance {
        totalGeneral
        totalAperGs
        totalVentaGs
        totalTarjeta
        totalRetiroGs
        totalGastoGs
        totalCierreGs
        diferenciaGs
        diferenciaRs
        diferenciaDs
      }
      sucursal {
        id
        nombre
      }
    }
  }
`;

export const cajaPorUsuarioIdAndAbiertoQuery = gql`
  query ($id: ID!) {
    data: cajaAbiertoPorUsuarioId(id: $id) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      sucursal {
        id
        nombre
      }
    }
  }
`;

export const cajaAbiertoPorUsuarioIdPorSucursalQuery = gql`
  query ($id: ID!, $sucId: ID) {
    data: cajaAbiertoPorUsuarioIdPorSucursal(id: $id, sucId: $sucId) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
    }
  }
`;

export const savePdvCaja = gql`
  mutation savePdvCaja($entity: PdvCajaInput!) {
    data: savePdvCaja(pdvCaja: $entity) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
    }
  }
`;

export const savePdvCajaPorSucursal = gql`
  mutation savePdvCajaPorSucursal($entity: PdvCajaInput!) {
    data: savePdvCajaPorSucursal(pdvCaja: $entity) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
    }
  }
`;

export const abrirCajaDesdeServidorQuery = gql`
  mutation abrirCajaDesdeServidor($input:PdvCajaInput!, $conteoInput: ConteoInput!, $conteoMonedaInputList: [ConteoMonedaInput]) {
    data: abrirCajaDesdeServidor(input:$input, conteoInput: $conteoInput, conteoMonedaInputList: $conteoMonedaInputList) {
      exito
      cajaId
    }
  }
`;

// ⚠️ El central NO tiene una mutation `cerrarCajaDesdeServidor`.
// Apertura y cierre son la MISMA mutation: `abrirCajaDesdeServidor`.
// Lo que las distingue es `cajaId`: si viene, el resolver lo trata como
// cierre (`boolean esCierre = cajaId != null`, PdvCajaGraphQL.java:221).
// El nombre de la operación es solo una etiqueta para los logs de red.
export const cerrarCajaDesdeServidorQuery = gql`
  mutation cerrarCajaDesdeServidor($input:PdvCajaInput!, $conteoInput: ConteoInput!, $conteoMonedaInputList: [ConteoMonedaInput], $cajaId: ID!) {
    data: abrirCajaDesdeServidor(input:$input, conteoInput: $conteoInput, conteoMonedaInputList: $conteoMonedaInputList, cajaId: $cajaId) {
      exito
      cajaId
    }
  }
`;

export const cajasAbiertasDesdeFilialesQuery = gql`
  query ($id: ID!) {
    data: cajasAbiertasPorUsuarioDesdeFiliales(id: $id) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      sucursalId
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
      }
      conteoCierre {
        id
        observacion
        creadoEn
      }
      sucursal {
        id
        nombre
      }
    }
  }
`;

// Query local del central sobre pdv_caja replicada (rápida, sin loop HTTP a filiales).
// Selección liviana a propósito: no trae conteos ni balance.
//
// `estado` y `fechaApertura` SÍ se piden aunque el repo anterior no lo hiciera:
// la lista muestra un chip de estado, y sin el campo el chip renderizaba "—"
// en todas las filas. Son dos columnas de la misma fila ya cargada: no agregan
// un join ni una consulta extra.
export const cajaAbiertoPorUsuarioIdLocalQuery = gql`
  query ($id: ID!) {
    data: cajaAbiertoPorUsuarioId(id: $id) {
      id
      sucursalId
      activo
      descripcion
      estado
      fechaApertura
      sucursal {
        id
        nombre
      }
    }
  }
`;

export const pdvCajaDesdeFilialQuery = gql`
  query ($id: ID!, $sucId: ID!) {
    data: pdvCajaDesdeFilial(id: $id, sucursalId: $sucId) {
      id
      descripcion
      activo
      estado
      tuvoProblema
      fechaApertura
      fechaCierre
      observacion
      sucursalId
      maletin {
        id
        descripcion
      }
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      conteoApertura {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      conteoCierre {
        id
        observacion
        creadoEn
        conteoMonedaList {
          id
          monedaBilletes {
            id
            moneda {
              id
              denominacion
            }
            valor
          }
          cantidad
        }
      }
      balance {
        totalGeneral
        diferenciaGs
        diferenciaRs
        diferenciaDs
      }
      sucursal {
        id
        nombre
      }
    }
  }
`;

export const deleteCajaQuery = gql`
  mutation deletePdvCaja($id: ID!, $sucId: ID) {
    data: deletePdvCaja(id: $id, sucId:$sucId)
  }
`;

export const imprimirBalanceQuery = gql`
  query imprimirBalance(
    $id: ID!
    $printerName: String
    $local: String
    $sucId: ID
    ) {
    data: imprimirBalance(
      id: $id
      printerName: $printerName
      local: $local,
      sucId: $sucId
      ) {
      id
    }
  }
`;
