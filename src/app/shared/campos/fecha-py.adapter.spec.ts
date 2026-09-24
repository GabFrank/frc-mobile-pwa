import { describe, expect, it } from 'vitest';

import { FechaPyDateAdapter } from './fecha-py.adapter';

/**
 * El adaptador tiene que traer su propio `@Injectable()`.
 *
 * Sin él la clase funciona igual —hereda el decorador de `NativeDateAdapter`—
 * pero Angular escupe un aviso de deprecación en **cada** instanciación, o sea
 * una línea por campo de fecha abierto, y avisa que va a ser error en una
 * versión futura. Es de las cosas que vuelven sin que nadie lo note, así que
 * se fija acá.
 */
describe('FechaPyDateAdapter', () => {
  it('declara su propia definición de inyección, no la heredada', () => {
    const propia = (clase: unknown, campo: string) =>
      Object.prototype.hasOwnProperty.call(clase, campo);

    expect(propia(FechaPyDateAdapter, 'ɵprov')).toBe(true);
    expect(propia(FechaPyDateAdapter, 'ɵfac')).toBe(true);
  });
});
