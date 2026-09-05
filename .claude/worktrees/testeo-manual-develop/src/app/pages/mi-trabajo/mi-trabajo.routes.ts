import { Routes } from '@angular/router';

import { rolGuard } from 'src/app/core/auth/rol.guard';

/**
 * «Mi trabajo» es **autoservicio**: cada uno ve lo suyo y el filtro es la
 * persona en sesión, no un rol. Por eso la raíz no lleva guard.
 *
 * La bandeja de **aprobaciones** no: ahí se mira y se resuelve lo que
 * pidieron **otros**.
 */
export const rutasMiTrabajo: Routes = [
  {
    path: '',
    loadComponent: () => import('./mi-trabajo.page').then((m) => m.MiTrabajoPage),
  },
  {
    path: 'aprobaciones',
    canActivate: [rolGuard('aprobacionesRrhh')],
    loadComponent: () => import('./aprobaciones.page').then((m) => m.AprobacionesPage),
  },
];
