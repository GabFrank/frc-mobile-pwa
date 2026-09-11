import { gql } from 'apollo-angular';

/**
 * Solicitud de pago a proveedor. Portadas de
 * `frc-mobile/src/app/pages/operaciones/solicitud-pago/graphql/`.
 *
 * ⚠️ **No se porta nada de `pago`.** El esquema expone `savePago`,
 * `pagoDetalle` y compañía, pero el alta de pagos es del desktop. De la
 * relación solo se **lee** `solicitudPago.pago`, para saber si ya se pagó.
 *
 * ⚠️ **Ninguna operación acá lleva sufijo `Mobile`.** Son las mismas que usa
 * el desktop y se consultan sin modificarlas; la única que es exclusiva de
 * mobile —`datosInicialesSolicitudPagoPorRecepcion`— ya venía así del
 * backend. Ver `docs/REGLAS_DESARROLLO.md`.
 */

/** Lo que se lee de un pago desde la solicitud. Solo lectura. */
const CAMPOS_PAGO = `
  pago {
    id
    estado
    programado
    creadoEn
    autorizadoPor {
      id
      persona {
        nombre
      }
    }
  }
`;

export const solicitudPagoPorIdQuery = gql`
  query ($id: ID!) {
    data: solicitudPago(id: $id) {
      id
      numeroSolicitud
      proveedor {
        id
        persona {
          nombre
        }
      }
      fechaSolicitud
      fechaPagoPropuesta
      montoTotal
      montoPagado
      moneda {
        id
        denominacion
        simbolo
      }
      formaPago {
        id
        descripcion
      }
      estado
      observaciones
      creadoEn
      usuario {
        id
        persona {
          nombre
        }
      }
      ${CAMPOS_PAGO}
      notasRecepcion {
        id
        montoIncluido
        notaRecepcion {
          id
          numero
          fecha
          valorTotal
          estado
        }
      }
    }
  }
`;

export const solicitudesPagoPaginadasQuery = gql`
  query ($page: Int, $size: Int, $proveedorId: ID, $estado: SolicitudPagoEstado) {
    data: solicitudesPagoPaginated(
      page: $page
      size: $size
      proveedorId: $proveedorId
      estado: $estado
    ) {
      getTotalPages
      getTotalElements
      getNumberOfElements
      isFirst
      isLast
      hasNext
      hasPrevious
      getContent {
        id
        numeroSolicitud
        proveedor {
          id
          persona {
            nombre
          }
        }
        fechaSolicitud
        fechaPagoPropuesta
        montoTotal
        moneda {
          id
          denominacion
          simbolo
        }
        formaPago {
          id
          descripcion
        }
        estado
        notasRecepcion {
          id
        }
      }
    }
  }
`;

/**
 * Una nota que todavía admite pago, buscada por número.
 *
 * ⚠️ **La elegibilidad la decide el backend, no el cliente.** Devuelve la
 * nota solo si está en `RECEPCION_COMPLETA`, no está marcada como pagada y no
 * pertenece ya a otra solicitud. Filtrar por estado del lado del cliente
 * dejaría entrar notas ya incluidas en otra solicitud —el dato de la
 * inclusión no viaja en la nota—.
 */
export const notaDisponibleParaPagoQuery = gql`
  query ($numero: Int!, $proveedorId: ID!) {
    data: notaRecepcionDisponibleParaPagoPorNumero(numero: $numero, proveedorId: $proveedorId) {
      id
      numero
      fecha
      valorTotal
      estado
      moneda {
        id
        denominacion
        simbolo
      }
      pedido {
        id
      }
    }
  }
`;

/**
 * Precarga del formulario a partir de una recepción finalizada.
 *
 * Trae las notas elegibles de esa recepción y las sugerencias ya resueltas
 * por el backend: moneda, forma de pago y fecha propuesta.
 */
export const datosInicialesPorRecepcionQuery = gql`
  query ($recepcionMercaderiaId: ID!) {
    data: datosInicialesSolicitudPagoPorRecepcion(recepcionMercaderiaId: $recepcionMercaderiaId) {
      notas {
        id
        numero
        fecha
        valorTotal
        estado
        moneda {
          id
          denominacion
          simbolo
        }
      }
      monedaId
      formaPagoId
      fechaPagoPropuesta
    }
  }
`;

export const formasPagoQuery = gql`
  query ($page: Int, $size: Int) {
    data: formasPago(page: $page, size: $size) {
      id
      descripcion
    }
  }
`;

/**
 * Alta de la solicitud.
 *
 * ⚠️ **El `montoTotal` que se manda no es el que queda guardado.** El backend
 * recalcula la cabecera sumando cada nota con sus rechazos descontados y
 * convertida a la moneda de la solicitud. Por eso la respuesta pide
 * `montoTotal`: es el único valor que vale mostrar.
 */
export const guardarSolicitudPagoMutation = gql`
  mutation ($entity: SolicitudPagoInput!) {
    data: saveSolicitudPago(entity: $entity) {
      id
      numeroSolicitud
      montoTotal
      estado
      fechaSolicitud
      moneda {
        id
        denominacion
        simbolo
      }
    }
  }
`;

export const solicitudPagoPdfMutation = gql`
  mutation ($solicitudPagoId: ID!) {
    data: imprimirSolicitudPagoPDF(solicitudPagoId: $solicitudPagoId)
  }
`;

/**
 * Cambia el estado de la solicitud.
 *
 * Acá se usa **solo para `PENDIENTE → SOLICITADO`**: validar el borrador y
 * ponerlo en la cola de pagos. El central valida la transición y rechaza
 * cualquier salto que no corresponda, así que no hace falta replicar la
 * máquina de estados en el cliente.
 *
 * ⚠️ Es la misma mutation que usa el desktop. No lleva sufijo `Mobile`
 * porque no se modifica su comportamiento. Ver `docs/REGLAS_DESARROLLO.md`.
 */
export const actualizarEstadoSolicitudPagoMutation = gql`
  mutation ($id: ID!, $estado: SolicitudPagoEstado!) {
    data: actualizarEstadoSolicitudPago(id: $id, estado: $estado) {
      id
      numeroSolicitud
      estado
    }
  }
`;
