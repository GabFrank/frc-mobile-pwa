import { describe, expect, it } from 'vitest';
import { inputCambioClave, validarNuevaContrasena } from './contrasena.util';

describe('validarNuevaContrasena', () => {
  it('pide la contraseña si está vacía', () => {
    expect(validarNuevaContrasena('', '')).toContain('Escribí');
  });

  it('rechaza espacios al borde', () => {
    expect(validarNuevaContrasena(' abcd', ' abcd')).toContain('espacios');
    expect(validarNuevaContrasena('abcd ', 'abcd ')).toContain('espacios');
  });

  it('exige el largo mínimo', () => {
    expect(validarNuevaContrasena('ab', 'ab')).toContain('al menos 3');
  });

  it('rechaza la clave de alta', () => {
    expect(validarNuevaContrasena('123', '123')).toContain('distinta');
  });

  it('exige que las dos coincidan', () => {
    expect(validarNuevaContrasena('abcd', 'abce')).toContain('no coinciden');
  });

  it('acepta una válida, con espacios en el medio', () => {
    expect(validarNuevaContrasena('mi clave', 'mi clave')).toBeNull();
  });
});

describe('inputCambioClave', () => {
  it('manda el usuario completo, con el creador que vino del central', () => {
    const input = inputCambioClave(
      { id: 7, nickname: 'MAYALA', activo: true, persona: { id: 30 }, usuario: { id: 1 } },
      'nueva',
    );
    expect(input).toEqual({
      id: 7,
      nickname: 'MAYALA',
      personaId: 30,
      usuarioId: 1,
      activo: true,
      password: 'nueva',
    });
  });

  it('sin creador ni persona manda null, no undefined', () => {
    const input = inputCambioClave({ id: 7, nickname: 'X' }, 'nueva');
    expect(input.personaId).toBeNull();
    expect(input.usuarioId).toBeNull();
    expect(input.activo).toBeNull();
  });
});
