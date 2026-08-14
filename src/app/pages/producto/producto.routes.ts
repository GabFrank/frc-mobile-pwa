import { Routes } from '@angular/router';

/**
 * Producto.
 *
 * La **búsqueda** no vive acá: es la pestaña `/buscar` de la barra inferior,
 * porque buscar un producto se hace todo el día y no es un paso dentro de
 * otra cosa. Este módulo agrupa lo que sí es de producto y se abre a
 * propósito.
 */
export const rutasProducto: Routes = [
  {
    path: 'vencidos',
    loadComponent: () =>
      import('./productos-vencidos.page').then((m) => m.ProductosVencidosPage),
  },
];
