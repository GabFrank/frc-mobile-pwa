import { Routes } from '@angular/router';

export const rutasCaja: Routes = [
  {
    path: '',
    loadComponent: () => import('./caja-lista.page').then((m) => m.CajaListaPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./caja-detalle.page').then((m) => m.CajaDetallePage),
  },
];
