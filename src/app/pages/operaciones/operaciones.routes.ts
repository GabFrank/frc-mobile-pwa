import { Routes } from '@angular/router';

/** Submódulos de operaciones. Se van sumando por olas. */
export const rutasOperaciones: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./operaciones.page').then((m) => m.OperacionesPage),
  },
  {
    path: 'caja',
    loadChildren: () => import('./caja/caja.routes').then((m) => m.rutasCaja),
  },
  {
    path: 'devolucion',
    loadChildren: () =>
      import('./devolucion/devolucion.routes').then((m) => m.rutasDevolucion),
  },
];
