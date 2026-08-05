import { Routes } from '@angular/router';

/**
 * ⚠️ `nueva` va **antes** que `detalle/:id`: si el paramétrico quedara
 * primero, capturaría la palabra y nunca se llegaría a la pantalla de carga.
 * Es el mismo orden que hizo falta en caja.
 */
export const rutasDevolucion: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./devolucion-historial.page').then((m) => m.DevolucionHistorialPage),
  },
  {
    path: 'nueva',
    loadComponent: () => import('./devolucion-nueva.page').then((m) => m.DevolucionNuevaPage),
  },
  {
    path: 'detalle/:id',
    loadComponent: () =>
      import('./devolucion-detalle.page').then((m) => m.DevolucionDetallePage),
  },
];
