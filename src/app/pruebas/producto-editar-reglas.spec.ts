import { describe, expect, it } from 'vitest';

import { Codigo } from '../domains/productos/codigo.model';
import type { PrecioPorSucursal } from '../domains/productos/precio-por-sucursal.model';
import type { Presentacion } from '../domains/productos/presentacion.model';
import {
  aplicarCascadaEnvase,
  codigosADegradar,
  esIdDeRutaInvalido,
  faltaParaGuardarProducto,
  idDeRutaNum,
  preciosADegradar,
  presentacionesADegradar,
} from '../pages/producto/editar/producto-editar.reglas';

describe('Un envase no tiene propiedades de mercadería', () => {
  it('apaga las seis banderas al marcar isEnvase', () => {
    // producto.component.ts:291-297 del escritorio.
    const r = aplicarCascadaEnvase({ isEnvase: true, balanza: true, lote: true });

    expect(r.balanza).toBe(false);
    expect(r.garantia).toBe(false);
    expect(r.ingrediente).toBe(false);
    expect(r.promocion).toBe(false);
    expect(r.vencimiento).toBe(false);
    expect(r.lote).toBe(false);
  });

  it('no toca combo', () => {
    // El escritorio NO lo apaga. Un combo-envase será raro, pero apagarlo
    // sería inventar una regla que nadie escribió.
    const r = aplicarCascadaEnvase({ isEnvase: true, combo: true });
    expect(r.combo).toBe(true);
  });

  it('no toca nada si isEnvase no se está marcando', () => {
    const r = aplicarCascadaEnvase({ isEnvase: false, balanza: true, lote: true });
    expect(r.balanza).toBe(true);
    expect(r.lote).toBe(true);
  });
});

describe('Qué falta para poder guardar el producto', () => {
  it('no falta nada con descripción', () => {
    expect(faltaParaGuardarProducto({ id: 1, descripcion: 'ALGO' })).toBeNull();
  });

  it('exige descripción', () => {
    // El central hace `e.getDescripcion().toUpperCase()` sin guard
    // (ProductoService.java:312): sin descripción, revienta el servidor.
    expect(faltaParaGuardarProducto({ id: 1, descripcion: null })).toBe(
      'La descripción es obligatoria',
    );
  });

  it('no acepta una descripción de solo espacios', () => {
    expect(faltaParaGuardarProducto({ id: 1, descripcion: '   ' })).toBe(
      'La descripción es obligatoria',
    );
  });
});

describe('Un solo principal por presentación', () => {
  const precios = (): PrecioPorSucursal[] => [
    { id: 1, precio: 12000, principal: true },
    { id: 2, precio: 11000, principal: false },
    { id: 3, precio: 10000, principal: true },
  ];

  it('devuelve los principales anteriores, sin el nuevo', () => {
    // adicionar-precio-dialog.component.ts:226-244 del escritorio. Sin esto
    // quedan dos principales y cuál gana lo decide el orden de la lista.
    expect(preciosADegradar(precios(), 3).map((p) => p.id)).toEqual([1]);
  });

  it('devuelve todos los principales cuando el nuevo es uno recién creado', () => {
    expect(preciosADegradar(precios(), null).map((p) => p.id)).toEqual([1, 3]);
  });

  it('no devuelve nada si no había ningún principal', () => {
    expect(preciosADegradar([{ id: 9, precio: 1, principal: false }], 9)).toEqual([]);
  });

  it('la misma regla vale para los códigos', () => {
    // `Codigo` es una clase con `toInput()` obligatorio: un objeto literal
    // no la satisface, hace falta una instancia real.
    const codigos: Codigo[] = [
      Object.assign(new Codigo(), { id: 4, codigo: '779', principal: true }),
      Object.assign(new Codigo(), { id: 5, codigo: '780', principal: false }),
    ];
    expect(codigosADegradar(codigos, 5).map((c) => c.id)).toEqual([4]);
  });

  it('la misma regla vale para las presentaciones, sin dimensión de sucursal', () => {
    // presentacion-editar.page.ts:358: marcar "Caja x12" principal sin
    // degradar "Unidad" deja dos presentaciones con principal = true, y
    // `presentacionPorCodigo()` desempata por orden de lista.
    const presentaciones: Presentacion[] = [
      { id: 1, principal: true },
      { id: 2, principal: false },
      { id: 3, principal: true },
    ];
    expect(presentacionesADegradar(presentaciones, 3).map((p) => p.id)).toEqual([1]);
  });

  it('presentaciones: devuelve todas las principales cuando la nueva es recién creada', () => {
    const presentaciones: Presentacion[] = [
      { id: 1, principal: true },
      { id: 2, principal: true },
    ];
    expect(presentacionesADegradar(presentaciones, null).map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('El id de un parámetro de ruta', () => {
  it('acepta un id positivo', () => {
    expect(esIdDeRutaInvalido('7')).toBe(false);
    expect(idDeRutaNum('7')).toBe(7);
  });

  it('rechaza una ruta vacía sin confundirla con el id cero', () => {
    // `Number('')` es 0, no NaN: sin el guard completo una ruta vacía se
    // leería como "id cero" en vez de como una ruta rota.
    expect(esIdDeRutaInvalido('')).toBe(true);
    expect(idDeRutaNum('')).toBeNull();
  });

  it('rechaza texto que no es un número', () => {
    expect(esIdDeRutaInvalido('abc')).toBe(true);
    expect(idDeRutaNum('abc')).toBeNull();
  });

  it('rechaza cero y negativos', () => {
    expect(esIdDeRutaInvalido('0')).toBe(true);
    expect(esIdDeRutaInvalido('-3')).toBe(true);
  });

  it('un parámetro todavía no asignado por el router no es inválido', () => {
    // El router asigna los parámetros después de construir el componente
    // (NG0950): `undefined` es "todavía no llegó", no una ruta rota.
    expect(esIdDeRutaInvalido(undefined)).toBe(false);
    expect(idDeRutaNum(undefined)).toBeNull();
  });

  it('un valor especial (por ejemplo "nueva") no es inválido', () => {
    expect(esIdDeRutaInvalido('nueva', 'nueva')).toBe(false);
    expect(idDeRutaNum('nueva', 'nueva')).toBeNull();
  });
});
