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

  it('la query pide todos los campos que el input puede pisar', () => {
    // Sin esto, agregar un campo al schema del central y no traerlo acá
    // borra ese campo en cada guardado, en silencio.
    const cuerpo = productoPorIdQuery.loc!.source.body;

    const sinEquivalenteEnLaQuery = ['id', 'usuarioId', 'imagenes'];
    const porNombreDistinto: Record<string, string> = {
      subfamiliaId: 'subfamilia',
      envaseId: 'envase',
    };

    for (const campo of CAMPOS_PRODUCTO_INPUT) {
      if (sinEquivalenteEnLaQuery.includes(campo)) continue;
      const buscado = porNombreDistinto[campo] ?? campo;
      expect(cuerpo, `la query no pide ${buscado}`).toMatch(
        new RegExp(`\\b${buscado}\\b`),
      );
    }
  });
});
