import gql from 'graphql-tag';

/**
 * ⚠️ **Estas operaciones llevan el alias `data:` agregado al portarlas.**
 * En `frc-mobile` eran las únicas del repo **sin** alias, porque el módulo
 * no pasaba por `GenericCrudService`. Acá sí pasan por `DatosService`, que
 * desenvuelve `data`: sin el alias el resultado llega `undefined` sin error
 * ni log. Ver la regla 1 de `CLAUDE.md`.
 *
 * ⚠️ Varios argumentos son **`Int!`**, no `ID!`. Mandar un string ahí hace
 * fallar la validación de la operación entera.
 */

const comentarioCampos = `
  id
  comentario
  mediaUrl
  creadoEn
  usuario {
    id
    nickname
    persona { id nombre imagenes }
  }
`;

export const notificacionesUsuarioQuery = gql`
  query notificacionesUsuario(
    $leidas: Boolean
    $page: Int
    $size: Int
    $estadoTablero: String
    $fechaInicio: String
    $fechaFin: String
  ) {
    data: notificacionesUsuario(
      leidas: $leidas
      page: $page
      size: $size
      estadoTablero: $estadoTablero
      fechaInicio: $fechaInicio
      fechaFin: $fechaFin
    ) {
      content {
        id
        leida
        fechaLeida
        fechaEntrega
        creadoEn
        notificacion {
          id
          titulo
          mensaje
          tipo
          creadoEn
          conteoComentarios
          data
        }
      }
      totalElements
      totalPages
      pageNumber
      pageSize
    }
  }
`;

export const marcarNotificacionLeidaMutation = gql`
  mutation marcarNotificacionLeida($notificacionId: Int!) {
    data: marcarNotificacionLeida(notificacionId: $notificacionId)
  }
`;

export const marcarTodasLeidasMutation = gql`
  mutation marcarTodasNotificacionesLeidas {
    data: marcarTodasNotificacionesLeidas
  }
`;

export const conteoNoLeidasQuery = gql`
  query conteoNotificacionesNoLeidas {
    data: conteoNotificacionesNoLeidas
  }
`;

export const comentariosNotificacionQuery = gql`
  query comentariosNotificacion($notificacionId: Int!) {
    data: comentariosNotificacion(notificacionId: $notificacionId) {
      ${comentarioCampos}
      comentarioPadre { id }
    }
  }
`;

export const crearComentarioMutation = gql`
  mutation crearComentarioNotificacion(
    $notificacionId: Int!
    $comentario: String!
    $comentarioPadreId: Int
    $mediaUrl: String
  ) {
    data: crearComentarioNotificacion(
      notificacionId: $notificacionId
      comentario: $comentario
      comentarioPadreId: $comentarioPadreId
      mediaUrl: $mediaUrl
    ) {
      ${comentarioCampos}
    }
  }
`;

export const misConfiguracionesQuery = gql`
  query misConfiguracionesNotificacion {
    data: misConfiguracionesNotificacion {
      tipo
      descripcion
      habilitado
      esObligatorio
    }
  }
`;

export const actualizarPreferenciaMutation = gql`
  mutation actualizarPreferenciaNotificacion($tipoNotificacion: String!, $habilitado: Boolean!) {
    data: actualizarPreferenciaNotificacion(
      tipoNotificacion: $tipoNotificacion
      habilitado: $habilitado
    )
  }
`;

/**
 * Pide al central que mande un push a una persona.
 *
 * ⚠️ **Es una `query`, no una `mutation`.** Así está declarada en el central
 * y así la usaba `frc-mobile`; escribirla como mutation la hace fallar con
 * un campo desconocido.
 *
 * ⚠️ **Va `personaId`, no `usuarioId`.** El push se dirige a la persona, que
 * es la que tiene los dispositivos registrados.
 */
export const solicitarPushQuery = gql`
  query solicitarPush($entity: NotificacionPushInput!) {
    data: requestPushNotification(entity: $entity)
  }
`;
