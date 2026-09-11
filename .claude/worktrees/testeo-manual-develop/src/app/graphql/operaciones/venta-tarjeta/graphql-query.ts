import gql from 'graphql-tag';

const campos = `
  id
  sucursalId
  codigoAutorizacion
  numeroBoleta
  monto
  montoEscaneado
  imagenUrl
  estado
  creadoEn
  venta {
    id
    totalGs
    creadoEn
    usuario { id nickname }
  }
  terminalPos {
    id
    codigo
    descripcion
    moneda { id simbolo denominacion }
  }
  caja { id }
  usuario { id nickname }
`;

/** ⚠️ El argumento se llama `ventaTarjeta`, no `entity`. */
export const saveVentaTarjetaMutation = gql`
  mutation saveVentaTarjeta($entity: VentaTarjetaInput!) {
    data: saveVentaTarjeta(ventaTarjeta: $entity) {
      ${campos}
    }
  }
`;

export const updateVentaTarjetaMutation = gql`
  mutation updateVentaTarjeta($entity: VentaTarjetaInput!) {
    data: updateVentaTarjeta(ventaTarjeta: $entity) {
      ${campos}
    }
  }
`;

export const ventasTarjetaPorCajaQuery = gql`
  query ventasTarjetaPorCaja($id: ID!, $sucId: ID!) {
    data: ventasTarjetaPorCaja(cajaId: $id, sucId: $sucId) {
      ${campos}
    }
  }
`;

export const ventaTarjetaPorIdQuery = gql`
  query ventaTarjetaPorId($id: ID!, $sucId: ID!) {
    data: ventaTarjetaPorId(id: $id, sucId: $sucId) {
      ${campos}
    }
  }
`;

export const ventaTarjetaPorVentaIdQuery = gql`
  query ventaTarjetaPorVentaId($ventaId: ID!, $sucId: ID!) {
    data: ventaTarjetaPorVentaId(ventaId: $ventaId, sucId: $sucId) {
      ${campos}
    }
  }
`;

/** Alimenta el contador de cupones pendientes de la caja. */
export const countVentasTarjetaSinRegistrarQuery = gql`
  query countVentasTarjetaSinRegistrar($id: ID!, $sucId: ID!) {
    data: countVentasTarjetaSinRegistrar(cajaId: $id, sucId: $sucId)
  }
`;

export const configuracionVentaTarjetaQuery = gql`
  {
    data: configuracionVentaTarjeta {
      id
      habilitado
    }
  }
`;
