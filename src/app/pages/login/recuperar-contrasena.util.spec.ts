import { afterEach, describe, expect, it } from 'vitest';
import {
  borrarSolicitudGuardada,
  EMAIL_VALIDO,
  guardarSolicitud,
  leerSolicitudGuardada,
  TELEFONO_VALIDO,
} from './recuperar-contrasena.util';

describe('solicitud guardada', () => {
  afterEach(() => sessionStorage.clear());

  it('sobrevive a una recarga y se borra al terminar', () => {
    guardarSolicitud({ solicitudId: 12, codigoSecreto: 'ABCD-EFGH' });
    expect(leerSolicitudGuardada()).toEqual({ solicitudId: 12, codigoSecreto: 'ABCD-EFGH' });
    borrarSolicitudGuardada();
    expect(leerSolicitudGuardada()).toBeNull();
  });

  it('ignora lo que no tiene forma de solicitud', () => {
    sessionStorage.setItem('frc.recuperacion.solicitud', '{"solicitudId":0,"codigoSecreto":"x"}');
    expect(leerSolicitudGuardada()).toBeNull();
    sessionStorage.setItem('frc.recuperacion.solicitud', 'no es json');
    expect(leerSolicitudGuardada()).toBeNull();
  });
});

describe('patrones', () => {
  it('teléfono', () => {
    expect(TELEFONO_VALIDO.test('0981 123 456')).toBe(true);
    expect(TELEFONO_VALIDO.test('+595 (981) 123-456')).toBe(true);
    expect(TELEFONO_VALIDO.test('123')).toBe(false);
    expect(TELEFONO_VALIDO.test('09a1123456')).toBe(false);
  });

  it('correo', () => {
    expect(EMAIL_VALIDO.test('juan.perez@gmail.com')).toBe(true);
    expect(EMAIL_VALIDO.test('juan@gmail')).toBe(false);
    expect(EMAIL_VALIDO.test('juan gmail.com')).toBe(false);
  });
});
