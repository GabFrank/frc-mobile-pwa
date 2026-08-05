import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { authGuard } from './core/auth/auth.guard';

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
        path: 'transferencias',
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
        path: 'cuenta',
        loadComponent: () => import('./pages/cuenta/cuenta.page').then((m) => m.CuentaPage),
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

  { path: '**', redirectTo: '' },
];
