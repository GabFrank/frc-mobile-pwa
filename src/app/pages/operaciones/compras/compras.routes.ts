import { Routes } from '@angular/router';

/**
 * Compras: la etapa «Recepción documental» del pedido hecha desde el celular.
 *
 * ⚠️ **`factura` y `nueva/…` van antes que `:pedidoId`.** Con el orden invertido el router
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
    // La factura crea la compra entera: misma pantalla que la conciliación, en modo «nueva».
    path: 'nueva/:documentoId',
    data: { modo: 'nueva' },
    loadComponent: () =>
      import('./factura-proveedor.page').then((m) => m.FacturaProveedorPage),
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
