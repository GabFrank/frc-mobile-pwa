import { Routes } from '@angular/router';

export const rutasMisRrhh: Routes = [
  {
    path: '',
    loadComponent: () => import('./mis-rrhh.page').then((m) => m.MisRrhhPage),
  },
  {
    path: 'aprobaciones',
    loadComponent: () => import('./aprobaciones-rrhh.page').then((m) => m.AprobacionesRrhhPage),
  },
];
