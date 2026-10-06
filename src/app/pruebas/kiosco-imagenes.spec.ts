import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ImagenesDePresentaciones, ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { PresentacionesImagenesGQL } from 'src/app/graphql/productos/presentacionesImagenes';
import { presentacionesImagenesQuery, productoSearchQuery } from 'src/app/graphql/productos/graphql-query';

const MINIATURA = 'data:image/jpg;base64,miniatura';
const MEDIANA = 'data:image/jpg;base64,mediana';
const SIN_IMAGEN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg';

/**
 * Cada pantalla pide el tamaño que dibuja (issue #263 del central): la tira
 * del kiosco, la miniatura; la foto grande, la mediana. La miniatura estirada
 * al alto de la ficha se ve borrosa.
 */
describe('fotos del kiosco por tamaño', () => {
  function servicio(filas: unknown) {
    const consultar = vi.fn().mockReturnValue(filas);
    TestBed.configureTestingModule({
      providers: [
        ProductoBusquedaService,
        { provide: DatosService, useValue: { consultar } },
        { provide: PresentacionesImagenesGQL, useValue: {} },
        // Los demás GQL del servicio se construyen pero acá no se usan.
        { provide: Apollo, useValue: {} },
      ],
    });
    return { busqueda: TestBed.inject(ProductoBusquedaService), consultar };
  }

  function leer(busqueda: ProductoBusquedaService): ImagenesDePresentaciones {
    let imagenes: ImagenesDePresentaciones | undefined;
    busqueda.imagenesDePresentaciones(1).subscribe((r) => (imagenes = r));
    expect(imagenes).toBeDefined();
    return imagenes!;
  }

  it('separa la miniatura de la tira de la mediana de la foto grande', () => {
    const { busqueda } = servicio(
      of([{ id: '7', imagenPrincipal: MINIATURA, imagenPrincipalMediana: MEDIANA }]),
    );

    const imagenes = leer(busqueda);

    expect(imagenes.miniaturas.get(7)).toBe(MINIATURA);
    expect(imagenes.medianas.get(7)).toBe(MEDIANA);
  });

  it('una presentación sin foto queda fuera de los dos mapas', () => {
    // Sin foto el central manda el PNG genérico en la miniatura y null en la mediana.
    const { busqueda } = servicio(
      of([{ id: '8', imagenPrincipal: SIN_IMAGEN, imagenPrincipalMediana: null }]),
    );

    const imagenes = leer(busqueda);

    expect(imagenes.miniaturas.size).toBe(0);
    expect(imagenes.medianas.size).toBe(0);
  });

  it('si la consulta falla devuelve los mapas vacíos, sin avisar', () => {
    const { busqueda, consultar } = servicio(throwError(() => new Error('sin red')));

    const imagenes = leer(busqueda);

    expect(imagenes.miniaturas.size + imagenes.medianas.size).toBe(0);
    expect(consultar.mock.calls[0][2]).toEqual({ mostrarCarga: false, notificarError: false });
  });

  it('la consulta del kiosco pide los dos tamaños y el buscador solo la miniatura', () => {
    const kiosco = presentacionesImagenesQuery.loc?.source.body ?? '';
    expect(kiosco).toMatch(/\bimagenPrincipal\b/);
    expect(kiosco).toMatch(/\bimagenPrincipalMediana\b/);

    const buscador = productoSearchQuery.loc?.source.body ?? '';
    expect(buscador).toMatch(/\bimagenPrincipalMiniatura\b/);
    // El original pesa cientos de KB: una lista no lo pide.
    expect(buscador).not.toMatch(/\bimagenPrincipal\b(?!Mini)/);
  });
});
