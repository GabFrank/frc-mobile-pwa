import { describe, expect, it } from 'vitest';

import { InventarioEstado, TipoInventario } from '../domains/inventario/inventario.model';
import type { Sector } from '../domains/sector/sector.model';
import type { Zona } from '../domains/zona/zona.model';
import {
  enPresentacion,
  enUnidades,
  hayZonaSinConcluir,
  nombreDeLugar,
  nuevoItemInput,
  presentacionParaNuevoLote,
  nuevoInventarioInput,
  zonasDisponibles,
} from '../pages/inventario/inventario-alta';

describe('Input de una toma nueva', () => {
  it('nace abierta, por zona y a nombre de quien la abre', () => {
    const input = nuevoInventarioInput({ sucursalId: 3, usuarioId: 41 });

    expect(input).toEqual({
      sucursalId: 3,
      usuarioId: 41,
      abierto: true,
      estado: InventarioEstado.ABIERTO,
      tipo: TipoInventario.ZONA,
    });
  });

  it('no manda id: un id nulo haría que el central lo tome como edición', () => {
    // `saveInventario` decide `esNuevo` con `input.getId() == null`, y de eso
    // depende el aviso push de «inventario iniciado».
    expect('id' in nuevoInventarioInput({ sucursalId: 3, usuarioId: 41 })).toBe(false);
  });
});

/**
 * Qué zonas se pueden sumar a una toma.
 *
 * ⚠️ **Una zona ya agregada no se puede volver a agregar.** La unicidad de
 * `inventario_producto` es `(inventario_id, zona_id)`: el central rechaza el
 * duplicado y el operador ve un error donde tendría que ver una lista más
 * corta. `frc-mobile` las descuenta antes de abrir el selector.
 */
describe('Zonas que se pueden sumar a la toma', () => {
  const sectores = (): Sector[] =>
    [
      {
        id: 1,
        descripcion: 'gondola central',
        zonaList: [
          { id: 11, descripcion: 'estante alto', activo: true },
          { id: 12, descripcion: 'estante bajo', activo: true },
        ],
      },
      {
        id: 2,
        descripcion: 'deposito',
        zonaList: [
          { id: 21, descripcion: 'rack a', activo: true },
          { id: 22, descripcion: 'rack viejo', activo: false },
        ],
      },
    ] as Sector[];

  it('ofrece todas las activas cuando la toma está vacía', () => {
    const opciones = zonasDisponibles(sectores(), []);
    expect(opciones.map((z) => z.zonaId)).toEqual([11, 12, 21]);
  });

  it('descuenta las que ya están en la toma', () => {
    const opciones = zonasDisponibles(sectores(), [
      { zona: { id: 12 } as Zona },
      { zona: { id: 21 } as Zona },
    ]);
    expect(opciones.map((z) => z.zonaId)).toEqual([11]);
  });

  it('deja afuera las zonas inactivas', () => {
    // Inactiva es «no se ofrece en tomas nuevas» sin tocar el histórico.
    expect(zonasDisponibles(sectores(), []).some((z) => z.zonaId === 22)).toBe(false);
  });

  it('el nombre de un lugar va con mayúscula inicial por palabra', () => {
    expect(nombreDeLugar('zona gaseosas')).toBe('Zona Gaseosas');
    expect(nombreDeLugar('deposito')).toBe('Deposito');
    expect(nombreDeLugar('DEPOSITO A-2')).toBe('Deposito A-2');
    expect(nombreDeLugar('estante café')).toBe('Estante Café');
    expect(nombreDeLugar('  ')).toBe('');
    expect(nombreDeLugar(null)).toBe('');
  });

  it('nombra la zona con su sector, que es como se la busca en el salón', () => {
    const [primera] = zonasDisponibles(sectores(), []);
    // Con mayúscula inicial, como en el resto del recorrido de la toma.
    expect(primera.texto).toBe('Estante Alto');
    expect(primera.detalle).toBe('Gondola Central');
  });

  it('un renglón sin zona no rompe ni tapa una zona válida', () => {
    // El central puede devolver un `inventarioProducto` con la zona borrada.
    const opciones = zonasDisponibles(sectores(), [{ zona: undefined }, {}]);
    expect(opciones.map((z) => z.zonaId)).toEqual([11, 12, 21]);
  });

  it('sin sectores devuelve una lista vacía, no revienta', () => {
    expect(zonasDisponibles([], [])).toEqual([]);
  });
});

/**
 * ⚠️ **Una sola zona abierta a la vez.** Es la regla de `frc-mobile`
 * (`verificarAbiertos`): contar dos zonas en paralelo desde el mismo teléfono
 * mezcla los conteos. Reabrir una con otra sin concluir queda bloqueado.
 */
describe('Zonas sin concluir', () => {
  it('detecta la que quedó abierta', () => {
    expect(hayZonaSinConcluir([{ id: 1, concluido: true }, { id: 2, concluido: false }])).toBe(true);
  });

  it('con todas concluidas, no hay ninguna', () => {
    expect(hayZonaSinConcluir([{ id: 1, concluido: true }])).toBe(false);
  });

  it('concluido sin valor cuenta como abierta', () => {
    // El central deja la columna en null hasta que alguien la concluye.
    expect(hayZonaSinConcluir([{ id: 1 }])).toBe(true);
  });

  it('una toma sin zonas no tiene ninguna abierta', () => {
    expect(hayZonaSinConcluir([])).toBe(false);
  });
});

describe('Presentación del renglón nuevo de un lote', () => {
  const p = (id: number, cantidad: number | null, activo = true) => ({ id, cantidad, activo }) as never;
  const id = (r: ReturnType<typeof presentacionParaNuevoLote>) =>
    'presentacion' in r ? r.presentacion.id : r.motivo;

  it('una x1 activa gana, aunque el renglón original sea una caja', () => {
    expect(id(presentacionParaNuevoLote([p(9, 1), p(10, 6)], 10))).toBe(9);
  });

  it('con varias x1 activas prefiere la del renglón original', () => {
    expect(id(presentacionParaNuevoLote([p(8, 1), p(9, 1)], 9))).toBe(9);
  });

  it('sin x1 activa, la del renglón original si está activa', () => {
    expect(id(presentacionParaNuevoLote([p(9, 1, false), p(10, 6), p(11, 12)], 10))).toBe(10);
  });

  it('sin x1 y con la original inactiva, la única activa', () => {
    expect(id(presentacionParaNuevoLote([p(10, 6, false), p(11, 12)], 10))).toBe(11);
  });

  it('ninguna activa', () => {
    expect(id(presentacionParaNuevoLote([p(9, 1, false), p(10, 6, false)], 10))).toBe('ninguna');
    expect(id(presentacionParaNuevoLote([], 10))).toBe('ninguna');
  });

  it('varias activas, ninguna x1 y la original inactiva: no adivina', () => {
    expect(id(presentacionParaNuevoLote([p(10, 6, false), p(11, 12), p(12, 24)], 10))).toBe('elegir');
  });

  it('una cantidad nula no es utilizable: el central no puede multiplicarla', () => {
    expect(id(presentacionParaNuevoLote([p(9, null), p(11, 12)], 9))).toBe(11);
  });
});

describe('El stock del sistema, en la presentación del renglón', () => {
  it('en una caja de 6, 12 unidades son 2', () => {
    expect(enPresentacion(12, 6)).toBe(2);
  });

  it('en la x1 no cambia', () => {
    expect(enPresentacion(12, 1)).toBe(12);
  });

  it('sin cantidad, o con cero, no divide', () => {
    expect(enPresentacion(12, null)).toBe(12);
    expect(enPresentacion(12, 0)).toBe(12);
  });

  it('lo contado pasa a unidades para compararlo con el sistema', () => {
    expect(enUnidades(2, 6)).toBe(12);
    expect(enUnidades(2, 1)).toBe(2);
    expect(enUnidades(2, null)).toBe(2);
  });

  it('el alta guarda el sistema en unidades, como lo define el central', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 10,
      cantidadPresentacion: 6,
      stock: 12,
      usuarioId: 41,
    });
    expect(input.cantidadFisica).toBe(12);
    expect(input.cantidadAnterior).toBe(12);
  });

  it('un peso contado se compara en unidades contra el sistema', () => {
    const input = nuevoItemInput({
      inventarioProductoId: 91,
      presentacionId: 10,
      cantidadPresentacion: 6,
      stock: 12,
      usuarioId: 41,
      peso: 2,
    });
    expect(input.verificado).toBe(true);
    expect(input.revisado).toBe(false);
  });
});
