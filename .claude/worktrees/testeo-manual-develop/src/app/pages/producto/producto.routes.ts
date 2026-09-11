import { Routes } from '@angular/router';

/**
 * Producto.
 *
 * La **búsqueda** no vive acá: es la pestaña `/buscar` de la barra inferior,
 * porque buscar un producto se hace todo el día y no es un paso dentro de
 * otra cosa. Este módulo agrupa lo que sí es de producto y se abre a
 * propósito.
 */
/**
 * ⚠️ `vencidos` va **antes** que `:id`: con el orden invertido, el router
 * resolvería «vencidos» como identificador y el detalle intentaría cargar el
 * producto NaN. Mismo orden que en recepción y solicitud de pago.
 */
export const rutasProducto: Routes = [
  {
    path: 'vencidos',
    loadComponent: () =>
      import('./productos-vencidos.page').then((m) => m.ProductosVencidosPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./producto-detalle.page').then((m) => m.ProductoDetallePage),
  },
];
