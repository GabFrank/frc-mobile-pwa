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

  it('acepta una corta: el central no pide mínimo', () => {
    expect(validarNuevaContrasena('ab', 'ab')).toBeNull();
  });

  it('rechaza un mismo carácter repetido, como el central', () => {
    expect(validarNuevaContrasena('aaaa', 'aaaa')).toContain('repetido');
    expect(validarNuevaContrasena('x', 'x')).toContain('repetido');
  });

  it('rechaza más de 50 caracteres', () => {
    const larga = 'ab'.repeat(26);
    expect(validarNuevaContrasena(larga, larga)).toContain('50');
  });

  it('rechaza el propio usuario, sin importar mayúsculas', () => {
    expect(validarNuevaContrasena('mayala', 'mayala', 'MAYALA')).toContain('usuario');
  });

  it('una de solo espacios cuenta como vacía', () => {
    expect(validarNuevaContrasena('   ', '   ')).toContain('Escribí');
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
