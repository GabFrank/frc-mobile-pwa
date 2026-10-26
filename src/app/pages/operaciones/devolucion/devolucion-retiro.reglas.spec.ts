import { describe, expect, it } from 'vitest';

import { RetiroProveedorConsolidado } from 'src/app/domains/devolucion/retiro.model';
import {
  cantidadDelProducto,
  devolucionesDelConsolidado,
  separarResultados,
  verificarEscaneo,
} from './devolucion-retiro.reglas';

const consolidado: RetiroProveedorConsolidado = {
  proveedorId: '7',
  grupos: [
    {
      sucursalId: '1',
      sucursalNombre: 'CENTRAL',
      devoluciones: [
        {
          devolucionId: '24',
          identificador: 'DEV-1-24',
          productos: [
            { descripcion: 'CORONITA', cantidad: 4, presentacion: 'x1' },
            { descripcion: 'CONTI MALZBIER', cantidad: 9, presentacion: 'x1' },
          ],
        },
      ],
    },
    {
      sucursalId: '13',
      sucursalNombre: 'AQUARIO',
      devoluciones: [{ devolucionId: '30', identificador: 'DEV-2-30', productos: [] }],
    },
  ],
};

describe('devolucionesDelConsolidado', () => {
  it('una entrada por devolución, con sus productos y su sucursal', () => {
    const lista = devolucionesDelConsolidado(consolidado);
    expect(lista.map((d) => d.devolucionId)).toEqual([24, 30]);
    expect(lista[0].productos).toHaveLength(2);
    expect(lista[1].sucursal).toBe('AQUARIO');
  });

  it('sin consolidado no hay nada que retirar', () => {
    expect(devolucionesDelConsolidado(null)).toEqual([]);
  });
});

describe('verificarEscaneo', () => {
  const lista = devolucionesDelConsolidado(consolidado);

  it('un QR verifica la devolución entera y trae sus productos', () => {
    const r = verificarEscaneo(lista, new Set(), 'DEV-1-24');
    expect(r.clase).toBe('verificada');
    if (r.clase === 'verificada') {
      expect(r.devolucion.productos).toHaveLength(2);
    }
  });

  it('vale escrito a mano', () => {
    expect(verificarEscaneo(lista, new Set(), ' dev-1-24 ').clase).toBe('verificada');
  });

  it('avisa si ya estaba verificada', () => {
    expect(verificarEscaneo(lista, new Set([24]), 'DEV-1-24').clase).toBe('repetida');
  });

  it('rechaza una devolución que no está en este retiro', () => {
    const r = verificarEscaneo(lista, new Set(), 'DEV-1-99');
    expect(r).toEqual({
      clase: 'ajena',
      mensaje: 'DEV-1-99 no está lista para retirar con este proveedor.',
    });
  });

  it('rechaza lo que no es una etiqueta de devolución', () => {
    expect(verificarEscaneo(lista, new Set(), '7790001234567').clase).toBe('ajena');
  });
});

describe('separarResultados', () => {
  it('separa las retiradas de las que fallaron, con su motivo', () => {
    expect(
      separarResultados({
        resultados: [
          { id: '24', ok: true },
          { id: '30', ok: false, mensaje: 'Stock insuficiente' },
        ],
      }),
    ).toEqual({ retiradas: [24], fallidas: [{ id: 30, mensaje: 'Stock insuficiente' }] });
  });
});

describe('cantidadDelProducto', () => {
  it('muestra la cantidad con el factor de la presentación', () => {
    expect(cantidadDelProducto({ cantidad: 4, presentacion: 'x12' })).toBe('4 x12');
    expect(cantidadDelProducto({ cantidad: 1.5 })).toBe('1.500');
  });
});
