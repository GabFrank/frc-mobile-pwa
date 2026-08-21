import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  Routes,
} from '@angular/router';
import { inject, isDevMode } from '@angular/core';
import { authGuard } from './core/auth/auth.guard';
import { rolGuard } from './core/auth/rol.guard';
import { destinoDeNotificacion } from './core/notificaciones/destino-notificacion';

/**
 * Rutas.
 *
 * Todo lo autenticado cuelga del shell. A diferencia de `frc-mobile`, donde
 * ninguna ruta declaraba `canActivate`, acá navegar por URL a una pantalla
 * protegida sin sesión redirige al login.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },

  /**
   * Kiosco: **fuera del shell a propósito**. Sin barra inferior ni FAB —es
   * una pantalla que mira un cliente, no un empleado navegando—, pero con
   * guard: los precios no son públicos.
   */
  {
    path: 'kiosco',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/producto/kiosco.page').then((m) => m.KioscoPage),
  },

  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () => import('./pages/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'operaciones',
        loadChildren: () =>
          import('./pages/operaciones/operaciones.routes').then((m) => m.rutasOperaciones),
      },
      {
        path: 'mi-trabajo',
        loadChildren: () =>
          import('./pages/mi-trabajo/mi-trabajo.routes').then((m) => m.rutasMiTrabajo),
      },
      {
        path: 'inventario',
        canActivate: [rolGuard('inventario')],
        loadChildren: () =>
          import('./pages/inventario/inventario.routes').then((m) => m.rutasInventario),
      },
      {
        path: 'transferencias',
        canActivate: [rolGuard('transferencias')],
        loadChildren: () =>
          import('./pages/transferencias/transferencias.routes').then(
            (m) => m.rutasTransferencias,
          ),
      },
      {
        path: 'notificaciones',
        loadChildren: () =>
          import('./pages/notificaciones/notificaciones.routes').then(
            (m) => m.rutasNotificaciones,
          ),
      },
      {
        path: 'marcacion',
        loadComponent: () =>
          import('./pages/marcacion/marcacion.page').then((m) => m.MarcacionPage),
      },
      {
        path: 'mis-finanzas',
        loadChildren: () =>
          import('./pages/mis-finanzas/mis-finanzas.routes').then((m) => m.rutasMisFinanzas),
      },
      {
        path: 'buscar',
        loadComponent: () => import('./pages/buscar/buscar.page').then((m) => m.BuscarPage),
      },
      {
        path: 'producto',
        loadChildren: () =>
          import('./pages/producto/producto.routes').then((m) => m.rutasProducto),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./pages/cuenta/cuenta.page').then((m) => m.CuentaPage),
      },
      {
        path: 'cuenta/rostro',
        loadComponent: () =>
          import('./pages/cuenta/enroll-facial.page').then((m) => m.EnrollFacialPage),
      },
    ],
  },

  // Galería del sistema de diseño: solo en desarrollo.
  ...(isDevMode()
    ? [
        {
          path: 'design-system',
          loadComponent: () =>
            import('./design-system/galeria.page').then((m) => m.GaleriaPage),
        },
      ]
    : []),

  /**
   * Cualquier ruta desconocida pasa por el traductor de destinos.
   *
   * ⚠️ **Acá aterriza el toque sobre una notificación.** El central manda
   * rutas del escritorio —`/productos/123`, `/financiero/gastos/9`— y el
   * service worker navega a lo que reciba. Antes esto redirigía a Inicio sin
   * mirar nada, así que tocar un aviso no llevaba a la pantalla del aviso.
   *
   * `destinoDeNotificacion` traduce lo que tiene equivalente y manda el resto
   * a la lista de notificaciones, que siempre dice algo sobre lo que se tocó.
   */
  {
    path: '**',
    canActivate: [
      (_ruta: ActivatedRouteSnapshot, estado: RouterStateSnapshot) => {
        const router = inject(Router);
        return router.parseUrl(destinoDeNotificacion(estado.url));
      },
    ],
    children: [],
  },
];
