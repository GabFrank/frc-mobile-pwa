import gql from 'graphql-tag';

/** ⚠️ El argumento se llama `marcacion`, no `entity`. */
export const saveMarcacionMutation = gql`
  mutation saveMarcacion($entity: MarcacionInput!) {
    data: saveMarcacion(marcacion: $entity) {
      id
      sucursalId
      tipo
      fechaEntrada
      fechaSalida
    }
  }
`;

const marcacionCorta = `
  id
  tipo
  fechaEntrada
  fechaSalida
`;

export const estadoMarcacionUsuarioQuery = gql`
  query ($usuarioId: ID!) {
    data: estadoMarcacionUsuario(usuarioId: $usuarioId) {
      accionPendiente
      puedeMarcarEntrada
      puedeMarcarSalida
      puedeMarcarSalidaAlmuerzo
      puedeMarcarEntradaAlmuerzo
      estaEnJornada
      jornadaRelevante {
        id
        sucursalId
        fecha
        estado
        minutosTrabajados
        minutosExtras
        minutosLlegadaTardia
        marcacionEntrada { ${marcacionCorta} }
        marcacionSalidaAlmuerzo { ${marcacionCorta} }
        marcacionEntradaAlmuerzo { ${marcacionCorta} }
        marcacionSalida { ${marcacionCorta} }
      }
    }
  }
`;
