import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ConvertirPreciosDesdeGQL, ConvertirPreciosGQL } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { ConversionPrecioService } from './conversion-precio.service';

describe('ConversionPrecioService.convertirDesde', () => {
  const hoy = { document: 'hoy' };
  const desde = { document: 'desde' };
  const fila = { moneda: { id: '2', denominacion: 'DOLAR', simbolo: 'US$' }, decimales: 2, montos: [1] };
  let respuestas: Map<unknown, () => Observable<unknown>>;
  let consultar: ReturnType<typeof vi.fn>;
  let servicio: ConversionPrecioService;

  beforeEach(() => {
    respuestas = new Map<unknown, () => Observable<unknown>>([
      [hoy, () => of([fila])],
      [desde, () => of([fila])],
    ]);
    consultar = vi.fn((gql: unknown) => respuestas.get(gql)!());
    TestBed.configureTestingModule({
      providers: [
        { provide: DatosService, useValue: { consultar } },
        { provide: ConvertirPreciosGQL, useValue: hoy },
        { provide: ConvertirPreciosDesdeGQL, useValue: desde },
      ],
    });
    servicio = TestBed.inject(ConversionPrecioService);
  });

  it('sin moneda de origen usa la consulta de siempre', () => {
    servicio.convertirDesde([100], null).subscribe();
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar.mock.calls[0][0]).toBe(hoy);
    expect(consultar.mock.calls[0][1]).toEqual({ montosGs: [100] });
  });

  it('con moneda de origen pide la nueva con montos y monedaOrigenId', () => {
    servicio.convertirDesde([4.5], 2).subscribe();
    expect(consultar.mock.calls[0][0]).toBe(desde);
    expect(consultar.mock.calls[0][1]).toEqual({ montos: [4.5], monedaOrigenId: 2 });
  });

  it('si la nueva falla (central viejo), cae a la de hoy tratando el importe como de la empresa', () => {
    respuestas.set(desde, () => throwError(() => new Error("Field 'convertirPreciosDesdeMobile' is undefined")));
    let filas: unknown;
    servicio.convertirDesde([4.5], 2).subscribe((f) => (filas = f));
    expect(consultar.mock.calls.map((c) => c[0])).toEqual([desde, hoy]);
    expect(consultar.mock.calls[1][1]).toEqual({ montosGs: [4.5] });
    expect(filas).toEqual([fila]);
  });

  it('si fallan las dos, lista vacía sin lanzar', () => {
    respuestas.set(desde, () => throwError(() => new Error('x')));
    respuestas.set(hoy, () => throwError(() => new Error('y')));
    let filas: unknown;
    servicio.convertirDesde([1], 2).subscribe((f) => (filas = f));
    expect(filas).toEqual([]);
  });
});
