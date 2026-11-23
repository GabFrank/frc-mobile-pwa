import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { PreciosEnOtraMonedaGQL } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { PrecioMonedaService, TOPE_LISTA_MS } from './precio-moneda.service';

describe('PrecioMonedaService', () => {
  const gql = { document: 'precios' };
  let respuesta: () => Observable<unknown>;
  let consultar: ReturnType<typeof vi.fn>;
  let servicio: PrecioMonedaService;
  let sesion: MonedasSesion;

  beforeEach(() => {
    respuesta = () => of([{ precioId: '10', moneda: { id: '2', denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 } }]);
    consultar = vi.fn(() => respuesta());
    TestBed.configureTestingModule({
      providers: [
        { provide: DatosService, useValue: { consultar } },
        { provide: PreciosEnOtraMonedaGQL, useValue: gql },
      ],
    });
    servicio = TestBed.inject(PrecioMonedaService);
    sesion = TestBed.inject(MonedasSesion);
  });

  it('carga la lista una vez, en silencio y sin caché', async () => {
    await servicio.cargar();
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar.mock.calls[0][2]).toEqual({ mostrarCarga: false, notificarError: false, gql: { fetchPolicy: 'network-only' } });
    expect(sesion.preciosMonedaSoportado()).toBe(true);
    expect(sesion.preciosMonedaListos()).toBe(true);
    expect(servicio.monedaDe(10)?.id).toBe(2);
    expect(servicio.monedaDe('99')).toBeNull();
    expect(servicio.monedaDe(null)).toBeNull();
  });

  it('lista vacía (bodega): soportado y todo en la moneda de la empresa', async () => {
    respuesta = () => of([]);
    await servicio.cargar();
    expect(sesion.preciosMonedaSoportado()).toBe(true);
    expect(servicio.monedaDe(10)).toBeNull();
  });

  it('central viejo: no soportado, mapa vacío y sin lanzar', async () => {
    respuesta = () => throwError(() => new Error("Field 'preciosEnOtraMoneda' is undefined"));
    await expect(servicio.cargar()).resolves.toBeUndefined();
    expect(sesion.preciosMonedaSoportado()).toBe(false);
    expect(sesion.preciosMonedaListos()).toBe(true);
    expect(sesion.preciosOtraMoneda().size).toBe(0);
  });

  it('listo() espera la carga en curso y no pide otra', async () => {
    const carga = servicio.cargar();
    await servicio.listo();
    await carga;
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(sesion.preciosMonedaListos()).toBe(true);
  });

  it('listo() sin carga previa la pide', async () => {
    await servicio.listo();
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it('limpiar la sesión borra la lista', async () => {
    await servicio.cargar();
    sesion.limpiar();
    expect(sesion.preciosOtraMoneda().size).toBe(0);
    expect(sesion.preciosMonedaListos()).toBe(false);
  });

  it('una carga vieja que termina tarde no pisa a la nueva', async () => {
    let liberar!: (v: unknown) => void;
    respuesta = () => new Observable((s) => { liberar = (v) => { s.next(v); s.complete(); }; });
    const vieja = servicio.cargar();
    respuesta = () => of([]);
    await servicio.cargar();
    liberar([{ precioId: '10', moneda: { id: '2' } }]);
    await vieja;
    expect(sesion.preciosOtraMoneda().size).toBe(0);
  });

  // #139: «no hubo respuesta» no es «central viejo».

  const sinRed = () => throwError(() => Object.assign(new Error('Http failure response'), { statusCode: 504 }));

  it('un fallo de transporte deja la lista sin respuesta y conserva lo que había', async () => {
    await servicio.cargar();
    respuesta = sinRed;
    await servicio.cargar();

    expect(sesion.preciosMonedaSinRespuesta()).toBe(true);
    expect(sesion.preciosMonedaSoportado()).toBe(true);
    expect(sesion.preciosOtraMoneda().size).toBe(1);
    expect(sesion.preciosMonedaListos()).toBe(true);
  });

  it('un error de GraphQL sigue siendo central viejo, no «sin respuesta»', async () => {
    respuesta = () => throwError(() => new Error("Validation error of type FieldUndefined: Field 'preciosEnOtraMoneda'"));
    await servicio.cargar();

    expect(sesion.preciosMonedaSinRespuesta()).toBe(false);
    expect(sesion.preciosMonedaSoportado()).toBe(false);
  });

  it('listo() vuelve a pedir tras un fallo de transporte, y no tras un central viejo', async () => {
    respuesta = sinRed;
    await servicio.cargar();
    respuesta = () => of([]);
    await servicio.listo();
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(sesion.preciosMonedaSinRespuesta()).toBe(false);
    expect(sesion.preciosMonedaSoportado()).toBe(true);

    respuesta = () => throwError(() => new Error('Field undefined'));
    await servicio.cargar();
    await servicio.listo();
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  it('dos listo() mientras reintenta hacen un solo pedido', async () => {
    respuesta = sinRed;
    await servicio.cargar();
    respuesta = () => of([]);
    await Promise.all([servicio.listo(), servicio.listo()]);

    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('una red colgada vence a los 8 s y queda sin respuesta', async () => {
    vi.useFakeTimers();
    try {
      respuesta = () => NEVER;
      const carga = servicio.cargar();
      await vi.advanceTimersByTimeAsync(TOPE_LISTA_MS);
      await carga;

      expect(sesion.preciosMonedaSinRespuesta()).toBe(true);
      expect(sesion.preciosMonedaListos()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
