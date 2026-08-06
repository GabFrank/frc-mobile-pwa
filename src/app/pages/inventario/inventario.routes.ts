import { Routes } from '@angular/router';

export const rutasInventario: Routes = [
  {
    path: '',
    loadComponent: () => import('./inventario-lista.page').then((m) => m.InventarioListaPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./inventario-detalle.page').then((m) => m.InventarioDetallePage),
  },
];
