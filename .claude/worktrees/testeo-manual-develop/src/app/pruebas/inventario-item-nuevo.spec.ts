import { describe, expect, it } from 'vitest';

import type { Presentacion } from '../domains/productos/presentacion.model';
import { nuevoItemInput } from '../pages/inventario/inventario-alta';

/**
 * El ítem que se crea al sumar un producto a la zona.
 *
 * ⚠️ **El stock del sistema va a `cantidadFisica`, no a `cantidad`.** Los
 * nombres engañan: `cantidad` es lo contado, y es el campo que el central
 * suma al finalizar. Ponerle el stock ahí haría que la toma se cierre sola
 * en cero diferencia sin que nadie haya contado nada.
 */
describe('Input de un ítem nuevo', () => {
  it('guarda el stock del sistema y deja el conteo vacío', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 9,
      stock: 42,
      usuarioId: 41,
    });

    expect(input.cantidadFisica).toBe(42);
    expect(input.cantidadAnterior).toBe(42);
    expect(input.cantidad).toBeUndefined();
  });

  it('no nace verificado ni revisado: nadie lo contó todavía', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 9,
      stock: 42,
      usuarioId: 41,
    });

    expect(input.verificado).toBe(false);
    expect(input.revisado).toBe(false);
  });

  it('no manda id, para que el central lo tome como alta', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 9,
      stock: 0,
      usuarioId: 41,
    });
    expect('id' in input).toBe(false);
  });

  it('un peso de balanza entra como lo contado', () => {
    // Pesar, escanear la etiqueta y que el conteo salga del código es el
    // flujo real de la balanza: el peso ES la cantidad contada.
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 9,
      stock: 42,
      usuarioId: 41,
      peso: 1.235,
    });

    expect(input.cantidad).toBe(1.235);
    // Y el stock sigue en su campo: la diferencia es 1,235 − 42.
    expect(input.cantidadFisica).toBe(42);
    expect(input.verificado).toBe(false);
    expect(input.revisado).toBe(true);
  });

  it('sin stock conocido asume cero, que es lo que dice el sistema', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 9,
      stock: null,
      usuarioId: 41,
    });
    expect(input.cantidadFisica).toBe(0);
  });
});
