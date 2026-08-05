import { Routes } from '@angular/router';

export const rutasMiTrabajo: Routes = [
  {
    path: '',
    loadComponent: () => import('./mi-trabajo.page').then((m) => m.MiTrabajoPage),
  },
  {
    path: 'aprobaciones',
    loadComponent: () => import('./aprobaciones.page').then((m) => m.AprobacionesPage),
  },
];
