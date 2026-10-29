import { Routes } from '@angular/router';

import { rolGuard } from 'src/app/core/auth/rol.guard';

/**
 * ⚠️ `nueva` y `retiro` van **antes** que `detalle/:id`: si el paramétrico quedara
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
    path: 'retiro',
    canActivate: [rolGuard('devolucionRetiro')],
    loadComponent: () =>
      import('./devolucion-retiro.page').then((m) => m.DevolucionRetiroPage),
  },
  {
    path: 'detalle/:id',
    loadComponent: () =>
      import('./devolucion-detalle.page').then((m) => m.DevolucionDetallePage),
  },
];
