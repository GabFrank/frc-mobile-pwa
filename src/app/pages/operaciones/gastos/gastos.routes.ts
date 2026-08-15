import { Routes } from '@angular/router';

/**
 * ⚠️ El detalle lleva **id y sucursal**: un `PreGasto` se resuelve por los
 * dos, y navegar solo con el id no encuentra nada.
 */
export const rutasGastos: Routes = [
  {
    path: '',
    loadComponent: () => import('./gastos-lista.page').then((m) => m.GastosListaPage),
  },
  /** ⚠️ `rendir` va antes que el detalle: si no, nunca se llega. */
  {
    path: ':id/:sucursalId/rendir',
    loadComponent: () =>
      import('./gastos-rendicion.page').then((m) => m.GastosRendicionPage),
  },
  {
    path: ':id/:sucursalId',
    loadComponent: () => import('./gastos-detalle.page').then((m) => m.GastosDetallePage),
  },
];
