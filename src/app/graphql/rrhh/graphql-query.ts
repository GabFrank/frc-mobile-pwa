import gql from 'graphql-tag';

export const miResumenRrhhMobileQuery = gql`
  query ($usuarioId: ID!) {
    data: miResumenRrhhMobile(usuarioId: $usuarioId) {
      funcionarioId nombre saldoVacacionesDias
      valesPendientesCantidad valesPendientesMonto
      ultimoReciboPeriodo ultimoReciboNeto
    }
  }
`;

export const misRecibosMobileQuery = gql`
  query ($usuarioId: ID!) {
    data: misRecibosMobile(usuarioId: $usuarioId) {
      id periodo totalNeto estado fechaPago
    }
  }
`;

export const misValesMobileQuery = gql`
  query ($usuarioId: ID!) {
    data: misValesMobile(usuarioId: $usuarioId) {
      id monto fecha estado esAdelanto motivo { id }
    }
  }
`;

export const misVacacionesMobileQuery = gql`
  query ($usuarioId: ID!) {
    data: misVacacionesMobile(usuarioId: $usuarioId) {
      id anioServicio diasGenerados diasGozados
    }
  }
`;

export const imprimirReciboLiquidacionQuery = gql`
  query ($id: ID!) { data: imprimirReciboLiquidacion(id: $id) }
`;

export const solicitarValeMobileMutation = gql`
  mutation ($usuarioId: ID!, $motivoId: ID, $monto: Float!, $esAdelanto: Boolean) {
    data: solicitarValeMobile(usuarioId: $usuarioId, motivoId: $motivoId, monto: $monto, esAdelanto: $esAdelanto) {
      id monto estado
    }
  }
`;

export const solicitarVacacionMobileMutation = gql`
  mutation ($usuarioId: ID!, $desde: String!, $hasta: String!) {
    data: solicitarVacacionMobile(usuarioId: $usuarioId, desde: $desde, hasta: $hasta) {
      id fechaDesde fechaHasta diasUsados estado
    }
  }
`;

export const valesPendientesAprobacionMobileQuery = gql`
  query {
    data: valesPendientesAprobacionMobile {
      id monto fecha esAdelanto funcionario { id persona { id nombre } }
    }
  }
`;

export const vacacionesPendientesAprobacionMobileQuery = gql`
  query {
    data: vacacionesPendientesAprobacionMobile {
      id fechaDesde fechaHasta diasUsados estado
      vacacion { id funcionario { id persona { id nombre } } }
    }
  }
`;

export const aprobarVacacionMobileMutation = gql`
  mutation ($periodoId: ID!, $aprobadorUsuarioId: ID) {
    data: aprobarVacacionMobile(periodoId: $periodoId, aprobadorUsuarioId: $aprobadorUsuarioId) { id estado }
  }
`;

export const misMarcacionesMobileQuery = gql`
  query ($usuarioId: ID!) {
    data: misMarcacionesMobile(usuarioId: $usuarioId) {
      id fecha minutosTrabajados minutosExtras minutosLlegadaTardia estado
    }
  }
`;
