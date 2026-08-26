import { describe, expect, it } from 'vitest';

import type { InventarioProducto } from '../domains/inventario/inventario.model';
import { rechazoAlAgregar } from '../pages/inventario/inventario-alta';

/**
 * Qué rechaza el central al sumar un producto a la toma, y por qué la app
 * tiene que saberlo antes de mandarlo.
 *
 * ⚠️ **La unicidad que aplica el central es `(inventario, producto,
 * vencimiento)`** — `InventarioProductoItemService.save()`, línea 265. No es
 * `(zona, presentación)`, que es lo que esta app venía cuidando:
 *
 * - el alcance es **toda la toma**, no la zona;
 * - la clave es el **producto**, no la presentación;
 * - y compara con `Objects.equals`, así que **dos vencimientos nulos son
 *   iguales** — y un ítem recién agregado nace sin fecha.
 *
 * Regresión: agregar un producto que ya estaba en otra zona de la misma toma
 * moría con un `IllegalStateException` crudo de Java en pantalla.
 */
describe('Choque al agregar un producto a la toma', () => {
  const zona = (
    id: number,
    descripcion: string,
    items: unknown[],
  ): InventarioProducto =>
    ({ id, zona: { id: id * 10, descripcion }, inventarioProductoItemList: items }) as InventarioProducto;

  const item = (id: number, presentacionId: number, productoId: number, vencimiento?: string) => ({
    id,
    vencimiento,
    presentacion: { id: presentacionId, producto: { id: productoId } },
  });

  const agregar = (zonas: InventarioProducto[], productoId = 200, presentacionId = 9) =>
    rechazoAlAgregar({ zonas, inventarioProductoId: 91, productoId, presentacionId });

  it('deja agregar un producto que la toma no tiene', () => {
    const zonas = [zona(91, 'gondola 1', [item(1, 8, 300)])];
    expect(agregar(zonas)).toBeNull();
  });

  it('el mismo producto en OTRA zona de la toma bloquea, y dice en cuál', () => {
    // Es el error reportado: la guarda vieja solo miraba la zona actual, así
    // que esto llegaba al central y volvía como excepción de Java.
    const zonas = [
      zona(91, 'gondola 1', []),
      zona(92, 'gondola 2', [item(1, 9, 200)]),
    ];
    const rechazo = agregar(zonas);

    expect(rechazo?.motivo).toBe('producto-sin-vencimiento');
    // Sin decir dónde está, el operador no puede hacer nada con el aviso.
    expect(rechazo?.mensaje).toContain('gondola 2');
  });

  it('otra presentación del mismo producto sin fecha también bloquea', () => {
    // «Unidad» y «caja x12» son dos ítems legítimos del producto, y este repo
    // lo documentaba así — pero el central compara por PRODUCTO, no por
    // presentación, y con los dos vencimientos en nulo los toma por iguales.
    const zonas = [zona(91, 'gondola 1', [item(1, 8, 200)])];
    const rechazo = agregar(zonas);

    expect(rechazo?.motivo).toBe('producto-sin-vencimiento');
  });

  it('si el que ya está tiene vencimiento, el nuevo entra', () => {
    // El central solo choca cuando las dos fechas son iguales. Con una
    // cargada y la otra en nulo no son iguales, y bloquear acá sería
    // inventar una restricción que el central no tiene.
    const zonas = [zona(91, 'gondola 1', [item(1, 8, 200, '2026-11-20')])];
    expect(agregar(zonas)).toBeNull();
  });

  it('la época Unix cuenta como sin vencimiento', () => {
    // El central serializa un Date nulo como 1970-01-01: en la base ese ítem
    // no tiene fecha, así que va a chocar igual.
    const zonas = [zona(91, 'gondola 1', [item(1, 8, 200, '1970-01-01 00:00')])];
    expect(agregar(zonas)?.motivo).toBe('producto-sin-vencimiento');
  });

  it('la misma presentación repetida en la zona se rechaza por su propio motivo', () => {
    // Regla de la app, no del central: dos renglones de la misma presentación
    // se suman los dos al finalizar y el conteo sale doble.
    const zonas = [zona(91, 'gondola 1', [item(1, 9, 200, '2026-11-20')])];
    const rechazo = agregar(zonas);

    // El motivo importa: sin él, el test pasaría igual rechazando por la
    // razón equivocada.
    expect(rechazo?.motivo).toBe('presentacion-repetida');
  });

  it('otro producto en la misma zona no molesta', () => {
    const zonas = [zona(91, 'gondola 1', [item(1, 8, 999)])];
    expect(agregar(zonas)).toBeNull();
  });

  it('una toma sin zonas no rechaza nada', () => {
    expect(rechazoAlAgregar({ zonas: [], inventarioProductoId: 91, productoId: 200, presentacionId: 9 })).toBeNull();
    expect(rechazoAlAgregar({ zonas: null, inventarioProductoId: 91, productoId: 200, presentacionId: 9 })).toBeNull();
  });

  it('los ids se comparan como texto, porque GraphQL los manda de las dos formas', () => {
    const zonas = [
      zona(91, 'gondola 1', []),
      { id: '92', zona: { id: 920, descripcion: 'gondola 2' },
        inventarioProductoItemList: [{ id: '1', presentacion: { id: '9', producto: { id: '200' } } }] },
    ] as unknown as InventarioProducto[];

    expect(agregar(zonas)?.motivo).toBe('producto-sin-vencimiento');
  });
});
