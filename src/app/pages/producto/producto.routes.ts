import { Routes } from '@angular/router';
import { rolGuard } from 'src/app/core/auth/rol.guard';

/**
 * Producto.
 *
 * La **búsqueda** no vive acá: es la pestaña `/buscar` de la barra inferior.
 */
/**
 * ⚠️ `vencidos` va **antes** que `:id`: con el orden invertido, el router
 * resolvería «vencidos» como identificador y el detalle intentaría cargar el
 * producto NaN. Mismo orden que en recepción y solicitud de pago. Cuando
 * llegue el alta, `nuevo` va en ese mismo primer bloque.
 */
export const rutasProducto: Routes = [
  {
    path: 'vencidos',
    loadComponent: () =>
      import('./productos-vencidos.page').then((m) => m.ProductosVencidosPage),
  },
  {
    path: ':id/editar',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/producto-editar.page').then((m) => m.ProductoEditarPage),
  },
  {
    path: ':id/editar/generales',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/datos-generales.page').then((m) => m.DatosGeneralesPage),
  },
  {
    path: ':id/editar/categoria',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/categoria.page').then((m) => m.CategoriaPage),
  },
  {
    path: ':id/editar/presentaciones',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/presentaciones.page').then((m) => m.PresentacionesPage),
  },
  {
    path: ':id/editar/presentacion/:presentacionId',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/presentacion-editar.page').then((m) => m.PresentacionEditarPage),
  },
  {
    path: ':id/editar/presentacion/:presentacionId/codigos',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/codigos.page').then((m) => m.CodigosPage),
  },
  {
    /**
     * ⚠️ **Guard propio.** Editar el precio es un permiso distinto de editar
     * el producto: 26 usuarios contra 32. Sin este guard, escribir la URL a
     * mano saltearía la fila deshabilitada del hub.
     */
    path: ':id/editar/presentacion/:presentacionId/precios',
    canActivate: [rolGuard('productoPrecios')],
    loadComponent: () =>
      import('./editar/precios.page').then((m) => m.PreciosPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./producto-detalle.page').then((m) => m.ProductoDetallePage),
  },
];
