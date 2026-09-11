import { describe, expect, it } from 'vitest';

import { enumerarEnEspanol } from '../pages/producto/editar/producto-editar.reglas';

describe('Enumerar en castellano', () => {
  it('con uno devuelve el elemento solo', () => {
    expect(enumerarEnEspanol(['un código'])).toBe('un código');
  });

  it('con dos los une con «y»', () => {
    expect(enumerarEnEspanol(['un código', 'un precio'])).toBe('un código y un precio');
  });

  it('con tres usa comas y una sola «y»', () => {
    // `join(' y ')` daba «una presentación y un código y un precio».
    expect(enumerarEnEspanol(['una presentación', 'un código', 'un precio'])).toBe(
      'una presentación, un código y un precio',
    );
  });

  it('con la lista vacía devuelve cadena vacía', () => {
    expect(enumerarEnEspanol([])).toBe('');
  });
});
