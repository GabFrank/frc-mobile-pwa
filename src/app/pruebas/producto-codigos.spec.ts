import { describe, expect, it } from 'vitest';

import { codigosADegradar } from '../pages/producto/editar/producto-editar.reglas';
import { construirCodigoInput } from '../pages/producto/editar/codigos.page';

describe('Guardar un código', () => {
  it('lo cuelga de la presentación, no del producto', () => {
    // Un mismo producto tiene un código para la unidad y otro para la caja:
    // es el código el que determina qué precio y qué cantidad corresponden.
    const input = construirCodigoInput(
      { id: null, codigo: '7790001', principal: false, activo: true },
      88,
    );
    expect(input.presentacionId).toBe(88);
  });

  it('manda null como id cuando el código es nuevo', () => {
    const input = construirCodigoInput(
      { id: null, codigo: '7790001', principal: false, activo: true },
      88,
    );
    expect(input.id).toBeNull();
  });

  it('degrada el principal anterior al marcar uno nuevo', () => {
    // Ids como string: así los manda el central (`Codigo.id` es `ID` en el
    // schema).
    const codigos = [
      { id: '1', codigo: '779', principal: true },
      { id: '2', codigo: '780', principal: false },
    ];
    expect(codigosADegradar(codigos, 2).map((c) => c.id)).toEqual(['1']);
  });
});
