import { Routes } from '@angular/router';
import { rolGuard } from 'src/app/core/auth/rol.guard';
import { ventaTarjetaHabilitadaGuard } from './venta-tarjeta.guard';

/**
 * Las dos rutas pasan por los dos guards: el módulo depende de un flag de
 * configuración **y** de estar en la caja. El flag decide si la empresa usa
 * la función; el rol, si esta persona la opera.
 */
export const rutasVentaTarjeta: Routes = [
  {
    path: '',
    canActivate: [rolGuard('ventaTarjeta'), ventaTarjetaHabilitadaGuard],
    loadComponent: () =>
      import('./venta-tarjeta-lista.page').then((m) => m.VentaTarjetaListaPage),
  },
  {
    path: 'registro',
    canActivate: [rolGuard('ventaTarjeta'), ventaTarjetaHabilitadaGuard],
    loadComponent: () =>
      import('./venta-tarjeta-registro.page').then((m) => m.VentaTarjetaRegistroPage),
  },
];
