import { Routes } from '@angular/router';
import { ventaTarjetaHabilitadaGuard } from './venta-tarjeta.guard';

/** Las dos rutas pasan por el guard: el módulo entero depende del flag. */
export const rutasVentaTarjeta: Routes = [
  {
    path: '',
    canActivate: [ventaTarjetaHabilitadaGuard],
    loadComponent: () =>
      import('./venta-tarjeta-lista.page').then((m) => m.VentaTarjetaListaPage),
  },
  {
    path: 'registro',
    canActivate: [ventaTarjetaHabilitadaGuard],
    loadComponent: () =>
      import('./venta-tarjeta-registro.page').then((m) => m.VentaTarjetaRegistroPage),
  },
];
