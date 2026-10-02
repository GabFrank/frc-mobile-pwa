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
  mismoId,
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

/**
 * ⚠️ Los ids de estos fixtures son **strings**, a propósito: `Presentacion`,
 * `Codigo` y `PrecioPorSucursal` declaran `id: ID` en el schema del central,
 * y GraphQL serializa `ID` como string en el JSON de la respuesta — nunca
 * como number, aunque el modelo TypeScript diga `id?: number`. Un fixture
 * con ids `number` deja pasar un `p.id !== nuevoPrincipalId` roto: con
 * strings, si alguien revierte `preciosADegradar`/`codigosADegradar`/
 * `presentacionesADegradar` a comparar con `===` en vez de `mismoId()`, la
 * comparación `'3' !== 3` da `true` y **nada se degrada nunca** — este test
 * lo agarra.
 */
describe('Un solo principal por presentación', () => {
  const precios = () =>
    [
      { id: '1', precio: 12000, principal: true },
      { id: '2', precio: 11000, principal: false },
      { id: '3', precio: 10000, principal: true },
    ] as unknown as PrecioPorSucursal[];

  it('devuelve los principales anteriores, sin el nuevo', () => {
    // adicionar-precio-dialog.component.ts:226-244 del escritorio. Sin esto
    // quedan dos principales y cuál gana lo decide el orden de la lista.
    // `nuevoPrincipalId` llega como number (así lo tipa la firma), pero los
    // ids de la lista son strings, como los manda el central: sin
    // `mismoId()` este `3` nunca matchea el `'3'` y el precio 3 se degrada
    // a sí mismo también.
    expect(preciosADegradar(precios(), 3).map((p) => p.id)).toEqual(['1']);
  });

  it('devuelve todos los principales cuando el nuevo es uno recién creado', () => {
    expect(preciosADegradar(precios(), null).map((p) => p.id)).toEqual(['1', '3']);
  });

  it('no devuelve nada si no había ningún principal', () => {
    expect(
      preciosADegradar(
        [{ id: '9', precio: 1, principal: false }] as unknown as PrecioPorSucursal[],
        9,
      ),
    ).toEqual([]);
  });

  it('la misma regla vale para los códigos, con el id como string', () => {
    // `Codigo` es una clase con `toInput()` obligatorio: un objeto literal
    // no la satisface, hace falta una instancia real.
    const codigos = [
      Object.assign(new Codigo(), { id: '4', codigo: '779', principal: true }),
      Object.assign(new Codigo(), { id: '5', codigo: '780', principal: false }),
    ] as unknown as Codigo[];
    expect(codigosADegradar(codigos, 5).map((c) => c.id)).toEqual(['4']);
  });

  it('la misma regla vale para las presentaciones, sin dimensión de sucursal', () => {
    // presentacion-editar.page.ts:358: marcar "Caja x12" principal sin
    // degradar "Unidad" deja dos presentaciones con principal = true, y
    // `presentacionPorCodigo()` desempata por orden de lista.
    const presentaciones = [
      { id: '1', principal: true },
      { id: '2', principal: false },
      { id: '3', principal: true },
    ] as unknown as Presentacion[];
    expect(presentacionesADegradar(presentaciones, 3).map((p) => p.id)).toEqual(['1']);
  });

  it('presentaciones: devuelve todas las principales cuando la nueva es recién creada', () => {
    const presentaciones = [
      { id: '1', principal: true },
      { id: '2', principal: true },
    ] as unknown as Presentacion[];
    expect(presentacionesADegradar(presentaciones, null).map((p) => p.id)).toEqual(['1', '2']);
  });
});

/**
 * `mismoId()` es el fix del bug: la comparación estricta entre el `number`
 * que declara el modelo y el `string` que manda GraphQL para un campo `ID`
 * es siempre `false`. Ver el aviso en `producto-editar.reglas.ts`.
 */
describe('mismoId compara un ID de GraphQL (string) contra un number', () => {
  it('compara igual un string y un number equivalentes', () => {
    expect(mismoId('261', 261)).toBe(true);
    expect(mismoId(261, '261')).toBe(true);
  });

  it('da false si son distintos', () => {
    expect(mismoId('261', 262)).toBe(false);
  });

  it('da false si cualquiera de los dos es null o undefined', () => {
    expect(mismoId(null, 261)).toBe(false);
    expect(mismoId(261, undefined)).toBe(false);
    expect(mismoId(null, undefined)).toBe(false);
  });

  it('da false ante algo que no es un número, en vez de reventar', () => {
    expect(mismoId('abc', 1)).toBe(false);
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
