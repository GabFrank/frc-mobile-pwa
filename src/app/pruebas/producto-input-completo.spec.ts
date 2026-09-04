import { describe, expect, it } from 'vitest';

import { productoPorIdQuery } from '../graphql/productos/graphql-query';
import type { Producto } from '../domains/productos/producto.model';
import {
  CAMPOS_PRODUCTO_INPUT,
  construirProductoInput,
} from '../pages/producto/editar/producto-editar.reglas';

/** Un producto con TODO cargado, como el que devuelve el central. */
const completo = (): Producto => ({
  id: 51,
  descripcion: 'ALGILEM GESIC 20 COMPRIMIDOS',
  descripcionFactura: 'ALGILEM GESIC',
  iva: 10,
  unidadPorCaja: 12,
  unidadPorCajaSecundaria: 144,
  balanza: false,
  stock: true,
  garantia: true,
  tiempoGarantia: 6,
  ingrediente: false,
  combo: false,
  promocion: false,
  vencimiento: true,
  diasVencimiento: 30,
  lote: true,
  cambiable: true,
  activo: true,
  propagado: true,
  tipoConservacion: 'NO_ENFRIABLE',
  subfamilia: { id: 7, descripcion: 'ANALGESICOS' },
  isEnvase: false,
  envase: undefined,
});

describe('El ProductoInput viaja completo', () => {
  it('trae los 25 campos aunque solo se cambie la descripción', () => {
    const input = construirProductoInput(completo(), {
      descripcion: 'ALGILEM GESIC 20 COMP.',
    });

    for (const campo of CAMPOS_PRODUCTO_INPUT) {
      expect(input, `falta el campo ${campo}`).toHaveProperty(campo);
    }
  });

  it('no apaga vencimiento ni lote al corregir la descripción', () => {
    // La regresión que este módulo existe para evitar: `saveProducto`
    // reemplaza la fila, así que un campo ausente se guarda en null y el
    // producto deja de pedir lote y fecha en cada recepción e inventario.
    const input = construirProductoInput(completo(), {
      descripcion: 'OTRA COSA',
    });

    expect(input.vencimiento).toBe(true);
    expect(input.diasVencimiento).toBe(30);
    expect(input.lote).toBe(true);
  });

  it('no desactiva el producto', () => {
    const input = construirProductoInput(completo(), { iva: 5 });
    expect(input.activo).toBe(true);
  });

  it('aplana subfamilia y envase a sus ids', () => {
    const input = construirProductoInput(completo(), {});
    expect(input.subfamiliaId).toBe(7);
    expect(input.envaseId).toBeNull();
  });

  it('los cambios pisan al producto hidratado', () => {
    const input = construirProductoInput(completo(), { iva: 5, balanza: true });
    expect(input.iva).toBe(5);
    expect(input.balanza).toBe(true);
  });

  it('un cambio en undefined no pisa el valor hidratado', () => {
    // La regresión que habilita el módulo de edición: un signal a medio
    // llenar puede mandar `{ descripcion: undefined }` sin querer borrar
    // nada. Si `undefined` pisara, Apollo omite la variable y el central
    // persiste `null`.
    const input = construirProductoInput(completo(), { descripcion: undefined });
    expect(input.descripcion).toBe('ALGILEM GESIC 20 COMPRIMIDOS');
  });

  it('la query pide todos los campos que el input puede pisar, en el nivel superior', () => {
    // Sin esto, agregar un campo al schema del central y no traerlo acá
    // borra ese campo en cada guardado, en silencio.
    //
    // ⚠️ Tiene que mirar SOLO la selección de nivel superior de
    // `producto(id: $id)`. Buscar contra el cuerpo entero es vacuo para
    // campos como `activo` o `descripcion`, que también aparecen anidados
    // bajo `codigos`, `presentaciones`, `precios`, `subfamilia`, `familia`,
    // `envase` y `tipoPresentacion`/`tipoPrecio`: borrar el campo de arriba
    // y el test seguiría pasando por el anidado.
    const cuerpo = productoPorIdQuery.loc!.source.body;
    const nivelSuperior = seleccionDeNivelSuperior(cuerpo, 'producto(id: $id)');

    const sinEquivalenteEnLaQuery = ['id', 'usuarioId', 'imagenes'];
    const porNombreDistinto: Record<string, string> = {
      subfamiliaId: 'subfamilia',
      envaseId: 'envase',
    };

    for (const campo of CAMPOS_PRODUCTO_INPUT) {
      if (sinEquivalenteEnLaQuery.includes(campo)) continue;
      const buscado = porNombreDistinto[campo] ?? campo;
      expect(nivelSuperior, `la query no pide ${buscado} en el nivel superior`).toMatch(
        new RegExp(`\\b${buscado}\\b`),
      );
    }
  });
});

/**
 * Recorta el cuerpo de una query GraphQL a los nombres de campo de nivel
 * superior de `campo(...)`, con los bloques anidados quitados por completo.
 *
 * 1. Ubica la selección de `campo(...) { ... }` contando llaves, para no
 *    cortar en la primera que cierra.
 * 2. Le quita, de adentro hacia afuera, todo bloque `{ ... }` anidado —así
 *    `subfamilia { id descripcion }` queda en `subfamilia` y ya no aporta
 *    `descripcion` ni `id` a la búsqueda.
 *
 * Sin el paso 2, `activo` o `descripcion` aparecen igual porque están
 * repetidos dentro de `codigos`, `presentaciones`, `precios`, `subfamilia`,
 * `familia`, `envase`, `tipoPresentacion` y `tipoPrecio` — borrar el campo de
 * arriba no haría fallar nada.
 */
function seleccionDeNivelSuperior(cuerpo: string, campo: string): string {
  const inicioCampo = cuerpo.indexOf(campo);
  if (inicioCampo === -1) {
    throw new Error(`no se encontró "${campo}" en la query`);
  }
  const inicioLlave = cuerpo.indexOf('{', inicioCampo);
  let profundidad = 0;
  let seleccion: string | undefined;
  for (let i = inicioLlave; i < cuerpo.length; i++) {
    if (cuerpo[i] === '{') profundidad++;
    else if (cuerpo[i] === '}') {
      profundidad--;
      if (profundidad === 0) {
        seleccion = cuerpo.slice(inicioLlave + 1, i);
        break;
      }
    }
  }
  if (seleccion === undefined) {
    throw new Error(`no se encontró el cierre de "${campo}" en la query`);
  }

  // Quita bloques anidados de adentro hacia afuera hasta que no quede
  // ninguno: cada pasada elimina los que ya no tienen llaves adentro.
  let sinAnidados = seleccion;
  let anterior: string;
  do {
    anterior = sinAnidados;
    sinAnidados = sinAnidados.replace(/\{[^{}]*\}/g, '');
  } while (sinAnidados !== anterior);

  return sinAnidados;
}
