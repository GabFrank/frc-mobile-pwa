import { Routes } from '@angular/router';

import { rolGuard } from 'src/app/core/auth/rol.guard';

export const rutasInventario: Routes = [
  {
    path: '',
    loadComponent: () => import('./inventario-lista.page').then((m) => m.InventarioListaPage),
  },
  /**
   * ⚠️ Literal antes que `:id`, como todo el repo: con el orden invertido
   * `/inventario/nuevo` resuelve `nuevo` como id y la pantalla carga el
   * inventario `NaN`.
   */
  {
    path: 'nuevo',
    canActivate: [rolGuard('inventarioAlta')],
    loadComponent: () => import('./inventario-nuevo.page').then((m) => m.InventarioNuevoPage),
  },
  {
    path: 'control',
    loadComponent: () =>
      import('./control-inventario.page').then((m) => m.ControlInventarioPage),
  },
  /**
   * Sectores y zonas cuelgan de la **sucursal**, no de un inventario. En
   * `frc-mobile` viven anidados bajo la toma, seis niveles adentro, y el id
   * del inventario viaja por todas esas rutas sin usarse.
   */
  {
    path: 'lugares',
    canActivate: [rolGuard('lugares')],
    loadComponent: () => import('./lugares.page').then((m) => m.LugaresPage),
  },
  {
    path: 'lugares/:sectorId',
    canActivate: [rolGuard('lugares')],
    loadComponent: () => import('./sector-detalle.page').then((m) => m.SectorDetallePage),
  },
  /** ⚠️ La carga va antes que el detalle: si no, `:id` se come la ruta. */
  {
    path: ':id/revisar',
    loadComponent: () =>
      import('./revisar-inventario.page').then((m) => m.RevisarInventarioPage),
  },
  {
    path: ':id/producto/:productoId',
    loadComponent: () => import('./inventario-carga.page').then((m) => m.InventarioCargaPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./inventario-detalle.page').then((m) => m.InventarioDetallePage),
  },
];
