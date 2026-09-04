import { describe, expect, it } from 'vitest';

import { InventarioEstado, TipoInventario } from '../domains/inventario/inventario.model';
import type { Sector } from '../domains/sector/sector.model';
import type { Zona } from '../domains/zona/zona.model';
import {
  hayZonaSinConcluir,
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

  it('nombra la zona con su sector, que es como se la busca en el salón', () => {
    const [primera] = zonasDisponibles(sectores(), []);
    expect(primera.texto).toBe('estante alto');
    expect(primera.detalle).toBe('gondola central');
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
