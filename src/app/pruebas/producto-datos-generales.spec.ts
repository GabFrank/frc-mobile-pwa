import { describe, expect, it } from 'vitest';

import { aplicarCascadaEnvase } from '../pages/producto/editar/producto-editar.reglas';
import { camposDeshabilitadosPorEnvase } from '../pages/producto/editar/datos-generales.page';

describe('Datos generales', () => {
  it('deshabilita las seis banderas cuando el producto es envase', () => {
    // Que el formulario las apague no alcanza: si siguen tocables, el
    // operador las prende y el guardado las vuelve a apagar sin decir nada.
    expect(camposDeshabilitadosPorEnvase(true)).toEqual([
      'balanza',
      'garantia',
      'ingrediente',
      'promocion',
      'vencimiento',
      'lote',
    ]);
  });

  it('no deshabilita nada cuando no es envase', () => {
    expect(camposDeshabilitadosPorEnvase(false)).toEqual([]);
  });

  it('la cascada y los campos deshabilitados coinciden', () => {
    // Si se agrega una bandera a una y no a la otra, el formulario muestra un
    // control editable cuyo valor el guardado descarta.
    const cascada = aplicarCascadaEnvase({ isEnvase: true });
    const apagados = Object.entries(cascada)
      .filter(([k, v]) => v === false && k !== 'isEnvase')
      .map(([k]) => k)
      .sort();

    expect(apagados).toEqual([...camposDeshabilitadosPorEnvase(true)].sort());
  });
});
