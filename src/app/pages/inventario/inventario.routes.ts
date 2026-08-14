import { Routes } from '@angular/router';

export const rutasInventario: Routes = [
  {
    path: '',
    loadComponent: () => import('./inventario-lista.page').then((m) => m.InventarioListaPage),
  },
  /** ⚠️ La carga va antes que el detalle: si no, `:id` se come la ruta. */
  {
    path: ':id/producto/:productoId',
    loadComponent: () => import('./inventario-carga.page').then((m) => m.InventarioCargaPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./inventario-detalle.page').then((m) => m.InventarioDetallePage),
  },
];
