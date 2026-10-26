import { Routes } from '@angular/router';

/**
 * Compras: la etapa «Recepción documental» del pedido hecha desde el celular.
 *
 * ⚠️ **`factura`, `foto` y `nueva/…` van antes que `:pedidoId`.** Con el orden invertido el router
 * resolvería «factura» como el pedido NaN. Es el error más repetido del repo
 * (PATRONES §4).
 */
export const rutasCompras: Routes = [
  {
    path: '',
    loadComponent: () => import('./compras-lista.page').then((m) => m.ComprasListaPage),
  },
  {
    // Lo abre el escáner universal con ?qr=: todavía no se sabe de qué pedido es.
    path: 'factura',
    loadComponent: () =>
      import('./factura-desde-qr.page').then((m) => m.FacturaDesdeQrPage),
  },
  {
    // Escanear el KuDE y ver la factura del proveedor en PDF. Solo consulta
    path: 'factura-pdf',
    loadComponent: () =>
      import('./factura-proveedor-pdf.page').then((m) => m.FacturaProveedorPdfPage),
  },
  {
    // La factura crea la compra entera: misma pantalla que la conciliación, en modo «nueva».
    path: 'nueva/:documentoId',
    data: { modo: 'nueva' },
    loadComponent: () =>
      import('./factura-proveedor.page').then((m) => m.FacturaProveedorPage),
  },
  {
    // Factura en papel: la IA lee la foto y el comprador revisa la cabecera. Sin pedido crea una
    // compra nueva; con pedido (`:pedidoId/foto`) la factura va a ese pedido.
    path: 'foto',
    loadComponent: () => import('./factura-foto.page').then((m) => m.FacturaFotoPage),
  },
  {
    path: ':pedidoId/foto',
    loadComponent: () => import('./factura-foto.page').then((m) => m.FacturaFotoPage),
  },
  {
    path: ':pedidoId',
    loadComponent: () => import('./compra-pedido.page').then((m) => m.CompraPedidoPage),
  },
  {
    path: ':pedidoId/factura/:documentoId',
    loadComponent: () =>
      import('./factura-proveedor.page').then((m) => m.FacturaProveedorPage),
  },
];
