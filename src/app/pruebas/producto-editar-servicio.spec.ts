import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import { Codigo } from '../domains/productos/codigo.model';
import type { Producto } from '../domains/productos/producto.model';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

// `Codigo` es una clase con `toInput()` obligatorio: un objeto literal
// `{ id, codigo }` no la satisface. `Object.assign(new Codigo(), {...})` es
// el mismo idioma que ya usan otros específs del repo para fixtures de
// clases del dominio (ver `buscar-producto.spec.ts`).
const codigo = (extra: Partial<Codigo>): Codigo => Object.assign(new Codigo(), extra);

const producto = (): Producto => ({
  id: 51,
  descripcion: 'ALGILEM GESIC',
  iva: 10,
  activo: true,
  vencimiento: true,
  diasVencimiento: 30,
  lote: true,
  presentaciones: [
    {
      id: 1,
      cantidad: 1,
      codigos: [codigo({ id: 10, codigo: '779' }), codigo({ id: 11, codigo: '780' })],
      precios: [{ id: 20, precio: 12000 }],
    },
    { id: 2, cantidad: 12, codigos: [codigo({ id: 12, codigo: '781' })], precios: [] },
  ],
});

describe('ProductoEditarService', () => {
  let datos: { porId: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let servicio: ProductoEditarService;

  beforeEach(() => {
    datos = {
      porId: vi.fn().mockReturnValue(of(producto())),
      guardar: vi.fn().mockReturnValue(of({ id: 51, descripcion: 'OTRA' })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...APOLLO_DE_PRUEBA],
      providers: [{ provide: DatosService, useValue: datos }],
    });
    servicio = TestBed.inject(ProductoEditarService);
  });

  it('cuenta los códigos y los precios de todas las presentaciones', () => {
    servicio.cargar(51);
    expect(servicio.totalCodigos()).toBe(3);
    expect(servicio.totalPrecios()).toBe(1);
  });

  it('rechaza un id inválido sin llamar al central', () => {
    // `Number('')` es 0, no NaN: sin este guard la app pide el producto cero.
    servicio.cargar(0);
    expect(datos.porId).not.toHaveBeenCalled();
    expect(servicio.error()).toBe('No se entiende qué producto abrir.');
  });

  it('manda el input completo al guardar solo la descripción', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ descripcion: 'OTRA' }).subscribe();

    const input = datos.guardar.mock.calls[0][1];
    expect(input.vencimiento).toBe(true);
    expect(input.diasVencimiento).toBe(30);
    expect(input.lote).toBe(true);
    expect(input.activo).toBe(true);
    expect(input.iva).toBe(10);
  });

  it('aplica la cascada del envase antes de guardar', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ isEnvase: true }).subscribe();

    const input = datos.guardar.mock.calls[0][1];
    expect(input.vencimiento).toBe(false);
    expect(input.lote).toBe(false);
  });

  it('no llama al central si falta la descripción', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ descripcion: '  ' }).subscribe({ error: () => undefined });
    expect(datos.guardar).not.toHaveBeenCalled();
  });
});
