import { describe, expect, it } from 'vitest';

import * as docs from '../graphql/productos/graphql-query';

const NUEVOS = [
  'saveProductoMutation',
  'savePresentacionMutation',
  'deletePresentacionMutation',
  'saveCodigoMutation',
  'deleteCodigoMutation',
  'savePrecioPorSucursalMutation',
  'deletePrecioPorSucursalMutation',
  'generarCodigoInternoQuery',
  'familiaSearchQuery',
  'subfamiliaSearchQuery',
  'tiposPresentacionQuery',
  'tipoPreciosQuery',
] as const;

describe('Las operaciones de escritura de producto', () => {
  it.each(NUEVOS)('%s existe', (nombre) => {
    expect(docs[nombre]).toBeDefined();
  });

  it.each(NUEVOS)('%s aliasea su campo raíz a data', (nombre) => {
    // Sin el alias el resultado llega `undefined` sin error ni log.
    const cuerpo = (docs[nombre] as { loc: { source: { body: string } } }).loc.source.body;
    expect(cuerpo).toMatch(/\bdata:\s*\w+/);
  });

  it('saveProducto manda el input bajo la variable entity', () => {
    // Es lo que arma `DatosService.guardar()`, que además completa usuarioId.
    const cuerpo = docs.saveProductoMutation.loc!.source.body;
    expect(cuerpo).toMatch(/\$entity:\s*ProductoInput!/);
    expect(cuerpo).toMatch(/producto:\s*\$entity/);
  });
});
