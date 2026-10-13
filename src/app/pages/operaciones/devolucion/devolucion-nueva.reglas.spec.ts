import { TipoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';
import {
  DatosDevolucionNueva,
  destinoParaInput,
  faltaParaGuardar,
  itemParaInput,
} from './devolucion-nueva.reglas';

const completa: DatosDevolucionNueva = {
  sucursalOperable: true,
  tipo: TipoDevolucion.CON_PROVEEDOR,
  proveedorId: 54,
  cantidadItems: 1,
};

describe('faltaParaGuardar', () => {
  it('con todo cargado no falta nada', () => {
    expect(faltaParaGuardar(completa)).toBeNull();
  });

  it('sin proveedor no pide proveedor', () => {
    expect(
      faltaParaGuardar({ ...completa, tipo: TipoDevolucion.SIN_PROVEEDOR, proveedorId: null }),
    ).toBeNull();
  });

  it('no asume sin proveedor: hasta que se elige, no se guarda', () => {
    expect(faltaParaGuardar({ ...completa, tipo: null, proveedorId: null })).toContain('proveedor');
  });

  it('con proveedor exige elegir cuál', () => {
    expect(faltaParaGuardar({ ...completa, proveedorId: null })).toContain('proveedor');
  });

  it('exige una sucursal que mueva stock', () => {
    expect(faltaParaGuardar({ ...completa, sucursalOperable: false })).toContain('sucursal');
  });

  it('exige al menos un producto', () => {
    expect(faltaParaGuardar({ ...completa, cantidadItems: 0 })).toContain('producto');
  });
});

describe('destinoParaInput', () => {
  it('con proveedor manda el tipo y el id', () => {
    expect(destinoParaInput(TipoDevolucion.CON_PROVEEDOR, 54)).toEqual({
      tipo: TipoDevolucion.CON_PROVEEDOR,
      proveedorId: 54,
    });
  });

  it('con proveedor y sin id lanza: no se degrada a sin proveedor', () => {
    expect(() => destinoParaInput(TipoDevolucion.CON_PROVEEDOR, null)).toThrow();
  });

  it('sin proveedor no manda proveedorId aunque haya quedado uno elegido', () => {
    const destino = destinoParaInput(TipoDevolucion.SIN_PROVEEDOR, 54);
    expect(destino).toEqual({ tipo: TipoDevolucion.SIN_PROVEEDOR });
    expect('proveedorId' in destino).toBe(false);
  });
});

describe('itemParaInput', () => {
  const draft = {
    producto: { id: 2 },
    presentacion: { id: 10 },
    motivoAveria: { id: 3 },
    cantidad: 4,
    lote: 'L-7',
  };

  it('con lote elegido manda su id', () => {
    expect(itemParaInput({ ...draft, loteId: 7 }).loteId).toBe(7);
  });

  it('sin lote elegido no manda la clave: un central viejo rechazaría el input', () => {
    const input = itemParaInput(draft);
    expect('loteId' in input).toBe(false);
    expect(input.lote).toBe('L-7');
  });
});
