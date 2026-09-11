import { Routes } from '@angular/router';

export const rutasCaja: Routes = [
  {
    path: '',
    loadComponent: () => import('./caja-lista.page').then((m) => m.CajaListaPage),
  },
  {
    path: 'abrir',
    loadComponent: () => import('./caja-abrir.page').then((m) => m.CajaAbrirPage),
  },
  // ⚠️ `abrir` va ANTES que `:id`, si no el router resuelve "abrir" como un
  // id de caja y la pantalla de apertura queda inalcanzable.
  {
    path: ':id/cerrar',
    loadComponent: () => import('./caja-cerrar.page').then((m) => m.CajaCerrarPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./caja-detalle.page').then((m) => m.CajaDetallePage),
  },
];
