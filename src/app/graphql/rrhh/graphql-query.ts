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

// ⚠️ NO pidas `vacacion` acá. El tipo `VacacionPeriodo` del central no tiene
// ese campo —ni ningún otro que lleve al funcionario—, así que la query
// portada de `frc-mobile` fallaba entera con
// "Field 'vacacion' in type 'VacacionPeriodo' is undefined": la bandeja de
// aprobaciones de vacaciones no podía funcionar.
//
// Consecuencia operativa: **el servidor no dice de quién es cada pedido**.
// La pantalla lo aclara en vez de mostrar un nombre inventado. Resolverlo
// requiere agregar el vínculo al funcionario en el schema del central.
export const vacacionesPendientesAprobacionMobileQuery = gql`
  query {
    data: vacacionesPendientesAprobacionMobile {
      id fechaDesde fechaHasta diasUsados estado observacion
    }
  }
`;

export const aprobarVacacionMobileMutation = gql`
  mutation ($periodoId: ID!, $aprobadorUsuarioId: ID) {
    data: aprobarVacacionMobile(periodoId: $periodoId, aprobadorUsuarioId: $aprobadorUsuarioId) { id estado }
  }
`;

// `page`/`size` son opcionales en el schema para no romper clientes viejos,
// pero acá se mandan siempre: sin ellos el central devuelve una fila por cada
// día trabajado desde que el funcionario entró.
export const misMarcacionesMobileQuery = gql`
  query ($usuarioId: ID!, $page: Int, $size: Int) {
    data: misMarcacionesMobile(usuarioId: $usuarioId, page: $page, size: $size) {
      id fecha minutosTrabajados minutosExtras minutosLlegadaTardia estado
    }
  }
`;
