import { describe, expect, it } from 'vitest';

import type { Producto } from '../domains/productos/producto.model';
import type { Presentacion } from '../domains/productos/presentacion.model';
import { faltaParaActivar } from '../pages/producto/editar/producto-editar.reglas';

/**
 * Un producto recién creado nace inactivo y solo se activa cuando se puede
 * vender: una presentación, un código que el lector encuentre y un precio que
 * la caja pueda cobrar. Activarlo antes pone en góndola algo que al escanearse
 * no se puede cobrar.
 */

/** Producto completo: una presentación con código y precio. */
const completo = (): Producto =>
  ({
  id: '51',
  descripcion: 'ALGO NUEVO',
  activo: false,
  presentaciones: [
    {
      id: '1',
      cantidad: 1,
      codigos: [{ id: '10', codigo: '7790001' }],
      precios: [{ id: '20', precio: 12000 }],
    },
  ],
  }) as unknown as Producto;

describe('Qué le falta a un producto para poder activarse', () => {
  it('no le falta nada cuando tiene presentación, código y precio', () => {
    expect(faltaParaActivar(completo())).toEqual([]);
  });

  it('pide una presentación cuando no tiene ninguna', () => {
    expect(faltaParaActivar({ ...completo(), presentaciones: [] })).toEqual([
      'una presentación',
      'un código',
      'un precio',
    ]);
  });

  it('pide una presentación cuando el producto ni siquiera trae la lista', () => {
    // `presentaciones` ausente y `presentaciones: []` significan lo mismo acá.
    expect(faltaParaActivar({ ...completo(), presentaciones: undefined })).toEqual([
      'una presentación',
      'un código',
      'un precio',
    ]);
  });

  it('pide un código cuando la presentación no tiene ninguno', () => {
    const p = completo();
    p.presentaciones![0].codigos = [];
    expect(faltaParaActivar(p)).toEqual(['un código']);
  });

  it('pide un precio cuando la presentación no tiene ninguno', () => {
    const p = completo();
    p.presentaciones![0].precios = [];
    expect(faltaParaActivar(p)).toEqual(['un precio']);
  });

  it('le alcanza con que UNA presentación esté completa', () => {
    // No se exige que todas lo estén: un producto puede tener la unidad lista
    // para vender y la caja todavía a medias.
    const p = completo();
    p.presentaciones!.push({ id: '2', cantidad: 12, codigos: [], precios: [] } as unknown as Presentacion);
    expect(faltaParaActivar(p)).toEqual([]);
  });

  it('no mezcla el código de una presentación con el precio de otra', () => {
    // Con código en una y precio en la otra, ninguna se puede vender: el
    // código resuelve la presentación, y es esa la que tiene que tener precio.
    const p = {
      ...completo(),
      presentaciones: [
        { id: '1', cantidad: 1, codigos: [{ id: '10', codigo: '779' }], precios: [] },
        { id: '2', cantidad: 12, codigos: [], precios: [{ id: '20', precio: 1 }] },
      ],
    } as unknown as Producto;
    expect(faltaParaActivar(p)).toEqual(['un código', 'un precio']);
  });

  it('ignora los códigos y precios inactivos', () => {
    // Un código inactivo sigue pegado a cajas viejas pero no sirve para vender
    // hoy; un precio inactivo no lo cobra la caja.
    const p = {
      ...completo(),
      presentaciones: [
        {
          id: '1',
          cantidad: 1,
          codigos: [{ id: '10', codigo: '779', activo: false }],
          precios: [{ id: '20', precio: 1, activo: false }],
        },
      ],
    } as unknown as Producto;
    expect(faltaParaActivar(p)).toEqual(['un código', 'un precio']);
  });
});
