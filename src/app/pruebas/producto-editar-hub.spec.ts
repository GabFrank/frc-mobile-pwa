import { describe, expect, it } from 'vitest';

import { rutasProducto } from '../pages/producto/producto.routes';

describe('Rutas de la edición de producto', () => {
  const ruta = (path: string) => rutasProducto.find((r) => r.path === path);

  it('la edición cuelga de :id', () => {
    expect(ruta(':id/editar')).toBeDefined();
  });

  it('la edición está guardada por rol', () => {
    expect(ruta(':id/editar')?.canActivate).toBeDefined();
  });

  it('los precios tienen su propio guard', () => {
    expect(ruta(':id/editar/presentacion/:presentacionId/precios')?.canActivate)
      .toBeDefined();
  });

  it('vencidos sigue antes que :id', () => {
    // Con el orden invertido el router resuelve «vencidos» como identificador
    // y el detalle intenta cargar el producto NaN.
    const iVencidos = rutasProducto.findIndex((r) => r.path === 'vencidos');
    const iId = rutasProducto.findIndex((r) => r.path === ':id');
    expect(iVencidos).toBeLessThan(iId);
  });

  it(':id/editar va antes que :id', () => {
    // Angular resuelve por orden y `:id` no matchea dos segmentos, pero el
    // orden explícito deja el archivo legible y a prueba de un `**` futuro.
    const iEditar = rutasProducto.findIndex((r) => r.path === ':id/editar');
    const iId = rutasProducto.findIndex((r) => r.path === ':id');
    expect(iEditar).toBeLessThan(iId);
  });
});
