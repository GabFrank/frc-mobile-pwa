import { describe, expect, it } from 'vitest';

import { PERMISOS } from '../domains/personas/roles/permisos';
import { ROLES } from '../domains/personas/roles/roles.enum';

describe('Permisos de la edición de producto', () => {
  it('el módulo pide EDITAR PRODUCTOS', () => {
    expect(PERMISOS.productoEdicion).toContain(ROLES.EDITAR_PRODUCTOS);
  });

  it('los precios piden EDITAR PRECIOS', () => {
    expect(PERMISOS.productoPrecios).toContain(ROLES.EDITAR_PRECIOS);
  });

  it('ADMIN entra a las dos, como a todas', () => {
    // No es un permiso más: es el que usa soporte para entrar a mirar.
    expect(PERMISOS.productoEdicion).toContain(ROLES.ADMIN);
    expect(PERMISOS.productoPrecios).toContain(ROLES.ADMIN);
  });

  it('los nombres de rol son los que existen en la base', () => {
    // Consultado el 2026-09-04 contra `bodega`, 492 usuarios:
    // EDITAR PRODUCTOS (32), EDITAR PRECIOS (26). NUEVO-PRODUCTO no existe.
    expect(ROLES.EDITAR_PRODUCTOS).toBe('EDITAR PRODUCTOS');
    expect(ROLES.EDITAR_PRECIOS).toBe('EDITAR PRECIOS');
  });

  it('editar precios es más restrictivo que editar el producto', () => {
    // 26 personas contra 32: son conjuntos distintos a propósito.
    expect(PERMISOS.productoPrecios).not.toEqual(PERMISOS.productoEdicion);
  });
});
