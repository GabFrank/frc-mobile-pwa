import { describe, expect, it } from 'vitest';
import { orderByIdAsc, orderByIdDesc, replaceObject } from './arraysUtil';

describe('arraysUtil', () => {
  const base = [{ id: 3 }, { id: 1 }, { id: 2 }];

  it('ordena ascendente sin mutar el original', () => {
    const original = [...base];
    expect(orderByIdAsc(base).map((e) => e.id)).toEqual([1, 2, 3]);
    expect(base).toEqual(original);
  });

  it('ordena descendente', () => {
    expect(orderByIdDesc(base).map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it('reemplaza por id devolviendo un array nuevo', () => {
    const arr = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }];
    const res = replaceObject(arr, { id: 2, n: 'B' });
    expect(res[1].n).toBe('B');
    // El original de frc-mobile mutaba la entrada, lo que rompía OnPush.
    expect(arr[1].n).toBe('b');
    expect(res).not.toBe(arr);
  });

  it('agrega si el id no existe', () => {
    const res = replaceObject([{ id: 1 }], { id: 9 });
    expect(res.map((e) => e.id)).toEqual([1, 9]);
  });

  it('tolera ids ausentes', () => {
    expect(() => orderByIdAsc([{}, { id: 1 }])).not.toThrow();
  });
});
