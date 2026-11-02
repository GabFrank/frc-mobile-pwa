import { describe, expect, it } from 'vitest';

import {
  devolucionDelIdentificador,
  normalizarIdentificador,
} from './devolucion-identificador';

describe('identificador de devolución', () => {
  it('lee el id de la devolución, que es el último número', () => {
    expect(devolucionDelIdentificador('DEV-1-24')).toBe(24);
    expect(devolucionDelIdentificador('DEV-13-1088')).toBe(1088);
  });

  it('acepta minúsculas y espacios, como lo carga una persona a mano', () => {
    expect(devolucionDelIdentificador('  dev-1-24 ')).toBe(24);
    expect(normalizarIdentificador(' dev-1-24')).toBe('DEV-1-24');
  });

  it('no confunde otros códigos con una devolución', () => {
    expect(devolucionDelIdentificador('7790001234567')).toBeNull();
    expect(devolucionDelIdentificador('frc-3-TRF-88-99----')).toBeNull();
    expect(devolucionDelIdentificador('DEV-1')).toBeNull();
    expect(devolucionDelIdentificador('DEV-1-0')).toBeNull();
    expect(devolucionDelIdentificador('')).toBeNull();
    expect(devolucionDelIdentificador(undefined)).toBeNull();
  });
});
