import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { PreciosEnOtraMonedaGQL } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { PrecioMonedaService } from './precio-moneda.service';

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
});
