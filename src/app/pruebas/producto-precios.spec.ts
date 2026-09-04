import { describe, expect, it } from 'vitest';

import { preciosADegradar } from '../pages/producto/editar/producto-editar.reglas';
import { construirPrecioInput, esPrecioEditable } from '../pages/producto/editar/precios.page';

describe('Editar un precio', () => {
  it('lo escribe en la sucursal de la sesión', () => {
    // El escritorio hace exactamente esto y no ofrece elegir:
    // adicionar-precio-dialog.component.ts:265.
    const input = construirPrecioInput(
      { id: null, precio: 12000, tipoPrecioId: 1, principal: true, activo: true },
      88,
      3,
    );
    expect(input.sucursalId).toBe(3);
    expect(input.presentacionId).toBe(88);
  });

  it('solo es editable el precio de la sucursal de la sesión', () => {
    // El `id` de `Sucursal` viaja como string (`ID` en el schema): un
    // fixture con ids `number` de los dos lados dejaría pasar un
    // `===` roto. `sucursalSesionId` sigue siendo number porque así lo
    // tipa la firma de `esPrecioEditable`.
    expect(esPrecioEditable({ sucursal: { id: '3' } }, 3)).toBe(true);
    expect(esPrecioEditable({ sucursal: { id: '7' } }, 3)).toBe(false);
  });

  it('un precio sin sucursal no es editable', () => {
    // «No sé de qué sucursal es» no es «es de la mía».
    expect(esPrecioEditable({ sucursal: undefined }, 3)).toBe(false);
  });

  it('degrada el principal anterior de esa presentación', () => {
    const precios = [
      { id: '1', precio: 12000, principal: true },
      { id: '2', precio: 11000, principal: false },
    ] as unknown as Parameters<typeof preciosADegradar>[0];
    expect(preciosADegradar(precios, 2).map((p) => p.id)).toEqual(['1']);
  });
});
