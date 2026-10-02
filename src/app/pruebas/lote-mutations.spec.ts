import { print } from 'graphql';
import { describe, expect, it } from 'vitest';

import { actualizarFechasLoteMutation, crearLoteMutation } from '../graphql/lote/graphql-query';

/**
 * Los nombres de las mutations de lote, fijados por un incidente.
 *
 * `crearLote` ya existía en el central para SIFEN —el lote de documentos
 * electrónicos, sin argumentos— y GraphQL fusiona los `extend type Mutation`
 * por nombre de campo: ganaba el de SIFEN, el central arrancaba sin quejarse y
 * la app recibía `Unknown field argument productoId @ 'crearLote'`, uno por
 * argumento. Nada de esto se veía hasta tocar «Crear nuevo lote» contra un
 * central real, así que el nombre se fija acá.
 */
describe('Mutations de lote', () => {
  it('el alta apunta a crearLoteProducto, no al crearLote de SIFEN', () => {
    const documento = print(crearLoteMutation);

    expect(documento).toContain('crearLoteProducto(');
    // ⚠️ `crearLoteProducto(` también contiene `crearLote`: se busca el nombre
    // exacto seguido del paréntesis, que es lo que el central resuelve.
    expect(documento).not.toContain('crearLote(');
  });

  it('la corrección de fechas sigue siendo actualizarFechasLote', () => {
    // Esta no choca con nada en el central; se fija para que el arreglo de la
    // otra no se la lleve puesta de paso.
    expect(print(actualizarFechasLoteMutation)).toContain('actualizarFechasLote(');
  });
});
