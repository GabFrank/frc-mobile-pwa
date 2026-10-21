import { gql } from 'apollo-angular';

/**
 * Compras desde el celular: cargar la factura del proveedor al pedido
 * escaneando el KuDE.
 *
 * Todas son `…Mobile` y **no las usa el desktop**: el central las agregó en
 * paralelo a las de `gestion-compras` para aplicar en el servidor las reglas
 * que allá viven en la pantalla (`compras-mobile.graphqls`).
 */

const CAMPOS_ITEM = `
  pedidoItemId
  productoId
  descripcion
  presentacionDescripcion
  presentacionCantidad
  cantidadSolicitada
  cantidadFacturada
  cantidadPendiente
  precioUnitario
  esBonificacion
  pendienteTexto
`;

const CAMPOS_NOTA = `
  id
  numero
  numeroCompleto
  timbrado
  cdc
  electronica
  fecha
  estado
  estadoEtiqueta
  valor
  monedaSimbolo
  cantidadItems
  itemsSinDistribuir
  puedeEliminar
`;

const CAMPOS_RESUMEN = `
  pedidoId
  proveedorId
  proveedorNombre
  proveedorRuc
  fecha
  monedaSimbolo
  totalPedido
  cantidadItems
  itemsPendientes
  cantidadNotas
  estadoEtapa
`;

const CAMPOS_PEDIDO = `
  pedidoId
  proveedorId
  proveedorNombre
  proveedorRuc
  fecha
  monedaDenominacion
  monedaSimbolo
  cotizacion
  estadoEtapa
  puedeCargarFacturas
  puedeFinalizar
  motivoNoOpera
  totalPedido
  totalFacturado
  itemsPendientes
  items { ${CAMPOS_ITEM} }
  notas { ${CAMPOS_NOTA} }
`;

const CAMPOS_FACTURA = `
  id
  modo
  formaPagoId
  formaPagoDescripcion
  tipoPagoFactura
  plazoCredito
  pedidoId
  cdc
  tipoDocumento
  tipoDocumentoDescripcion
  emisorRuc
  emisorNombre
  receptorRuc
  receptorNombre
  timbrado
  establecimiento
  puntoExpedicion
  numero
  numeroCompleto
  fechaEmision
  condicion
  moneda
  monedaSimbolo
  cotizacion
  subtotalExenta
  subtotalIva5
  subtotalIva10
  totalDescuento
  totalGeneral
  totalIva5
  totalIva10
  totalIva
  totalNota
  consultadaEn
  proveedorId
  proveedorNombre
  renglonesOk
  renglonesConDiferencia
  renglonesFueraDePedido
  renglonesSinProducto
  renglonesSinObservacion
  puedeConfirmar
  motivoNoConfirma
  notaRecepcionId
  avisos { tipo nivel mensaje }
  renglones {
    id
    orden
    codigoProveedor
    gtin
    gtinPaquete
    descripcion
    unidadMedida
    cantidad
    precioUnitario
    descuentoUnitario
    porcentajeDescuento
    total
    tasaIva
    ivaTexto
    lote
    vencimiento
    esBonificacion
    estado
    estadoEtiqueta
    tipoMatch
    tipoMatchEtiqueta
    productoId
    productoDescripcion
    presentacionId
    presentacionDescripcion
    factor
    pedidoItemId
    cantidadBase
    precioUnitarioBase
    pedidoCantidadPendiente
    pedidoPrecioUnitario
    diferencias
    avisosIva
    avisos
    requiereObservacion
    observacionFaltante
    observacion
    sugerencias {
      productoId
      presentacionId
      descripcion
      presentacionDescripcion
      factor
      codigo
      tipo
      motivo
    }
  }
  itemsNoFacturados { ${CAMPOS_ITEM} }
`;

export const pedidosEsperandoFacturaQuery = gql`
  query ($texto: String, $proveedorId: ID, $page: Int, $size: Int) {
    data: pedidosEsperandoFacturaMobile(texto: $texto, proveedorId: $proveedorId, page: $page, size: $size) {
      getTotalPages
      getTotalElements
      hasNext
      getContent { ${CAMPOS_RESUMEN} }
    }
  }
`;

export const pedidoComprasQuery = gql`
  query ($pedidoId: ID!) {
    data: pedidoComprasMobile(pedidoId: $pedidoId) { ${CAMPOS_PEDIDO} }
  }
`;

export const pedidosParaFacturaQuery = gql`
  query ($qr: String!) {
    data: pedidosParaFacturaMobile(qr: $qr) {
      cdc
      tipoDocumentoDescripcion
      numeroCompleto
      proveedorRuc
      proveedorId
      proveedorNombre
      pedidos { ${CAMPOS_RESUMEN} }
    }
  }
`;

export const facturaProveedorQuery = gql`
  query ($id: ID!, $pedidoId: ID) {
    data: facturaProveedorMobile(id: $id, pedidoId: $pedidoId) { ${CAMPOS_FACTURA} }
  }
`;

export const resumenFinalizarNotasQuery = gql`
  query ($pedidoId: ID!) {
    data: resumenFinalizarNotasMobile(pedidoId: $pedidoId) {
      pedidoId
      puedeFinalizar
      motivo
      cantidadNotas
      totalFacturado
      notasPendientes
      itemsSinFacturar { ${CAMPOS_ITEM} }
      avisos
    }
  }
`;

export const leerFacturaProveedorMutation = gql`
  mutation ($pedidoId: ID!, $qr: String!) {
    data: leerFacturaProveedorMobile(pedidoId: $pedidoId, qr: $qr) { ${CAMPOS_FACTURA} }
  }
`;

export const vincularRenglonFacturaMutation = gql`
  mutation ($renglonId: ID!, $presentacionId: ID!, $factor: Float, $recordar: Boolean) {
    data: vincularRenglonFacturaMobile(
      renglonId: $renglonId
      presentacionId: $presentacionId
      factor: $factor
      recordar: $recordar
    ) { ${CAMPOS_FACTURA} }
  }
`;

export const observarRenglonFacturaMutation = gql`
  mutation ($renglonId: ID!, $observacion: String) {
    data: observarRenglonFacturaMobile(renglonId: $renglonId, observacion: $observacion) { ${CAMPOS_FACTURA} }
  }
`;

export const confirmarFacturaMutation = gql`
  mutation ($documentoId: ID!, $pedidoId: ID!) {
    data: confirmarFacturaMobile(documentoId: $documentoId, pedidoId: $pedidoId) { ${CAMPOS_NOTA} }
  }
`;

export const eliminarNotaComprasMutation = gql`
  mutation ($notaId: ID!) {
    data: eliminarNotaComprasMobile(notaId: $notaId) { ${CAMPOS_PEDIDO} }
  }
`;

export const finalizarRecepcionNotasMutation = gql`
  mutation ($pedidoId: ID!) {
    data: finalizarRecepcionNotasMobile(pedidoId: $pedidoId) { ${CAMPOS_PEDIDO} }
  }
`;

export const facturaNuevaCompraQuery = gql`
  query ($id: ID!) {
    data: facturaNuevaCompraMobile(id: $id) { ${CAMPOS_FACTURA} }
  }
`;

export const opcionesNuevaCompraQuery = gql`
  query {
    data: opcionesNuevaCompraMobile {
      formasPago { id descripcion }
      sucursales { id descripcion }
    }
  }
`;

export const leerFacturaNuevaCompraMutation = gql`
  mutation ($qr: String!) {
    data: leerFacturaNuevaCompraMobile(qr: $qr) { ${CAMPOS_FACTURA} }
  }
`;

export const crearCompraDesdeFacturaMutation = gql`
  mutation (
    $documentoId: ID!
    $formaPagoId: ID
    $plazoCredito: Int
    $sucursalId: ID!
    $finalizarNotas: Boolean
  ) {
    data: crearCompraDesdeFacturaMobile(
      documentoId: $documentoId
      formaPagoId: $formaPagoId
      plazoCredito: $plazoCredito
      sucursalId: $sucursalId
      finalizarNotas: $finalizarNotas
    ) { ${CAMPOS_PEDIDO} }
  }
`;

export const presentacionesCompraQuery = gql`
  query ($productoId: ID!, $renglonId: ID) {
    data: presentacionesCompraMobile(productoId: $productoId, renglonId: $renglonId) {
      id
      descripcion
      cantidad
      codigo
      sugerida
      motivo
    }
  }
`;
