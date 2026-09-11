import { Routes } from '@angular/router';

/**
 * ⚠️ **`nueva` va antes que `:id`.** Con el orden invertido el router
 * resolvería «nueva» como identificador y el detalle intentaría cargar la
 * solicitud número NaN. Mismo orden que en recepción.
 */
export const rutasSolicitudPago: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./solicitudes-pago-lista.page').then((m) => m.SolicitudesPagoListaPage),
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./solicitud-pago-nueva.page').then((m) => m.SolicitudPagoNuevaPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./solicitud-pago-detalle.page').then((m) => m.SolicitudPagoDetallePage),
  },
];
