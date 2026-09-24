import { Routes } from '@angular/router';

import { rolGuard } from 'src/app/core/auth/rol.guard';

/** Submódulos de operaciones. Se van sumando por olas. */
export const rutasOperaciones: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./operaciones.page').then((m) => m.OperacionesPage),
  },
  {
    path: 'caja',
    canActivate: [rolGuard('caja')],
    loadChildren: () => import('./caja/caja.routes').then((m) => m.rutasCaja),
  },
  {
    path: 'gastos',
    loadChildren: () => import('./gastos/gastos.routes').then((m) => m.rutasGastos),
  },
  {
    path: 'venta-tarjeta',
    loadChildren: () =>
      import('./venta-tarjeta/venta-tarjeta.routes').then((m) => m.rutasVentaTarjeta),
  },
  {
    path: 'recepcion',
    canActivate: [rolGuard('recepcion')],
    loadChildren: () =>
      import('./recepcion/recepcion.routes').then((m) => m.rutasRecepcion),
  },
  {
    path: 'devolucion',
    loadChildren: () =>
      import('./devolucion/devolucion.routes').then((m) => m.rutasDevolucion),
  },
  {
    path: 'solicitud-pago',
    loadChildren: () =>
      import('./solicitud-pago/solicitud-pago.routes').then((m) => m.rutasSolicitudPago),
  },
];
