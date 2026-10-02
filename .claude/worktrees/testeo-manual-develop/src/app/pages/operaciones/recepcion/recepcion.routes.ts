import { Routes } from '@angular/router';

/**
 * ⚠️ **`nueva` va antes que `:id`.** Con el orden invertido, el router
 * resolvería «nueva» como un id y la pantalla intentaría cargar la recepción
 * número NaN.
 */
export const rutasRecepcion: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./recepciones-lista.page').then((m) => m.RecepcionesListaPage),
  },
  {
    path: 'nueva',
    loadComponent: () => import('./recepcion-nueva.page').then((m) => m.RecepcionNuevaPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./recepcion-detalle.page').then((m) => m.RecepcionDetallePage),
  },
];
