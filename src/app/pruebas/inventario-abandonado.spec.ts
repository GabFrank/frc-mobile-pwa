import { describe, expect, it } from 'vitest';

import type { Inventario } from '../domains/inventario/inventario.model';
import { antiguedadEnDias, avisoDeTomasAbiertas } from '../pages/inventario/inventario-alta';

/**
 * Tomas abiertas y olvidadas.
 *
 * ⚠️ **No son una anomalía puntual.** En la base real de bodega, `SUC.
 * CENTRAL` tiene **24 inventarios en estado `ABIERTO`**, el más viejo de
 * mayo de 2023, casi todos de otros usuarios y sin ítems cargados; y hay
 * 2.851 filas donde `estado` y `abierto` no coinciden. Una pantalla que
 * asuma «a lo sumo hay una» y bloquee hasta cerrarla deja el alta inutilizable.
 */
describe('Antigüedad de una toma', () => {
  const ahora = new Date('2026-08-25T12:00:00');

  it('cuenta los días desde el inicio', () => {
    expect(antiguedadEnDias('2026-08-20 09:00', ahora)).toBe(5);
  });

  it('una de hoy no tiene antigüedad', () => {
    expect(antiguedadEnDias('2026-08-25 08:00', ahora)).toBe(0);
  });

  it('lee el formato del central, con y sin hora', () => {
    // Llega `yyyy-MM-dd HH:mm` —con espacio, no con la T de ISO—, que Safari
    // no parsea con `new Date(string)`.
    // Sin hora se toma medianoche, así que da un día más que la misma fecha
    // a las 14:23. Los dos valores van distintos a propósito: si la función
    // ignorara la hora, este test no lo notaría.
    expect(antiguedadEnDias('2023-05-24 14:23', ahora)).toBe(1188);
    expect(antiguedadEnDias('2023-05-24', ahora)).toBe(1189);
  });

  it('sin fecha no inventa una antigüedad', () => {
    expect(antiguedadEnDias(undefined, ahora)).toBeNull();
    expect(antiguedadEnDias('', ahora)).toBeNull();
    // La época Unix es una fecha ausente, no una toma de 1970.
    expect(antiguedadEnDias('1970-01-01 00:00', ahora)).toBeNull();
  });
});

describe('Aviso de tomas abiertas', () => {
  const ahora = new Date('2026-08-25T12:00:00');
  const toma = (id: number, fecha: string): Inventario => ({ id, fechaInicio: fecha });

  it('sin ninguna abierta no hay nada que avisar', () => {
    expect(avisoDeTomasAbiertas([], ahora)).toBeNull();
  });

  it('con una, la nombra', () => {
    expect(avisoDeTomasAbiertas([toma(7533, '2026-06-12 14:58')], ahora)).toContain('#7533');
  });

  it('con varias, dice cuántas: es el dato que cambia la decisión', () => {
    // Ver una sola hace pensar «la cierro y sigo». Ver que son 24 dice que el
    // problema es otro y que cerrarlas de a una no es el camino.
    const aviso = avisoDeTomasAbiertas(
      [toma(1041, '2023-05-25 14:03'), toma(2076, '2023-09-22 08:24'), toma(7533, '2026-06-12 14:58')],
      ahora,
    );
    expect(aviso).toContain('3');
  });

  it('menciona la más vieja cuando lleva años abierta', () => {
    const aviso = avisoDeTomasAbiertas([toma(1041, '2023-05-25 14:03')], ahora);
    expect(aviso).toMatch(/1187|años|año/);
  });

  it('una toma de hoy no se describe como abandonada', () => {
    const aviso = avisoDeTomasAbiertas([toma(9000, '2026-08-25 09:00')], ahora);
    expect(aviso).not.toMatch(/años|abandonad/i);
  });
});
