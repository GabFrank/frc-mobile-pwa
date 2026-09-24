import { Routes } from '@angular/router';

import { rolGuard } from 'src/app/core/auth/rol.guard';

export const rutasTransferencias: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./transferencias-lista.page').then((m) => m.TransferenciasListaPage),
  },
  /**
   * ⚠️ El literal va antes que `:id`, como en todo el repo: con el orden
   * invertido `/transferencias/nueva` resuelve `nueva` como id y el detalle
   * carga la transferencia `NaN`.
   */
  {
    path: 'nueva',
    canActivate: [rolGuard('transferenciasAlta')],
    loadComponent: () =>
      import('./transferencia-nueva.page').then((m) => m.TransferenciaNuevaPage),
  },
  /**
   * La carga de productos de un borrador. El detalle manda acá cuando la
   * transferencia todavía está en creación, y esta pantalla manda al detalle
   * cuando ya salió: así la lista puede seguir navegando siempre a
   * `/transferencias/:id`.
   */
  {
    path: ':id/borrador',
    canActivate: [rolGuard('transferenciasAlta')],
    loadComponent: () =>
      import('./transferencia-borrador.page').then((m) => m.TransferenciaBorradorPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./transferencia-detalle.page').then((m) => m.TransferenciaDetallePage),
  },
];
