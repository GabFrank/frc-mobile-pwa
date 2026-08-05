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
  {
    path: ':id/:sucursalId',
    loadComponent: () => import('./gastos-detalle.page').then((m) => m.GastosDetallePage),
  },
];
