import { Routes } from '@angular/router';

export const rutasTransferencias: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./transferencias-lista.page').then((m) => m.TransferenciasListaPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./transferencia-detalle.page').then((m) => m.TransferenciaDetallePage),
  },
];
