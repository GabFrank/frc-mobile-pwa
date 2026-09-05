import { Routes } from '@angular/router';

/**
 * ⚠️ `preferencias` va **antes** que `:id`: si el paramétrico quedara
 * primero, capturaría la palabra y nunca se llegaría a la pantalla.
 *
 * En `frc-mobile` había dos rutas raíz distintas —`/notificacion` y
 * `/comentarios`— que cargaban **el mismo módulo**. Acá es una sola: el hilo
 * de comentarios es el detalle de una notificación, no otra sección.
 */
export const rutasNotificaciones: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./notificaciones.page').then((m) => m.NotificacionesPage),
  },
  {
    path: 'preferencias',
    loadComponent: () =>
      import('./preferencias.page').then((m) => m.PreferenciasPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./comentarios.page').then((m) => m.ComentariosPage),
  },
];
