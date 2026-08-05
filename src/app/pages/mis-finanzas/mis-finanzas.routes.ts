import { Routes } from '@angular/router';

/**
 * `frc-mobile` registraba `list-convenio` como ruta aparte, con y sin
 * parámetros, y el dashboard era una pantalla con dos tarjetas. Acá la lista
 * es la pantalla: no hay nada que elegir antes de verla.
 */
export const rutasMisFinanzas: Routes = [
  {
    path: '',
    loadComponent: () => import('./mis-finanzas.page').then((m) => m.MisFinanzasPage),
  },
];
