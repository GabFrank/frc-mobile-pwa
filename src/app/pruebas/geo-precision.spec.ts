import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CALENTAMIENTO_MS,
  GeoService,
  PRECISION_DESCARTE_M,
  ProgresoGeo,
  TIEMPO_MAXIMO_MS,
} from '../core/dispositivo/geo.service';

/**
 * El tope de precisión del GPS.
 *
 * El plugin nativo de `frc-mobile` no acumulaba lecturas peores que ±80 m; el
 * port lo había perdido y al agotarse el tiempo usaba cualquiera. En bodega,
 * el 06/10/2026, eso mostró una sucursal a más de un kilómetro de donde
 * estaba la persona.
 */
describe('GeoService: una lectura muy imprecisa no se usa', () => {
  const PERMISO_NEGADO = 1;
  const TIEMPO_AGOTADO = 3;

  let alLeer: PositionCallback;
  let alFallar: PositionErrorCallback;
  let clearWatch: ReturnType<typeof vi.fn>;
  let progresos: ProgresoGeo[];

  const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  /** El teléfono informa una lectura con esa precisión. */
  const leer = (precision: number, latitud = -24.0633, longitud = -54.316) =>
    alLeer({ coords: { latitude: latitud, longitude: longitud, accuracy: precision } } as GeolocationPosition);

  const fallar = (code: number) => alFallar({ code } as GeolocationPositionError);

  /** Pide la posición y deja pasar el calentamiento. */
  const pedir = async () => {
    const promesa = new GeoService().posicionActual((p) => progresos.push(p));
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    return promesa;
  };

  const ultimoMensaje = () => progresos[progresos.length - 1]?.mensaje ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    progresos = [];
    clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (ok: PositionCallback, error: PositionErrorCallback) => {
          alLeer = ok;
          alFallar = error;
          return 7;
        },
        clearWatch,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original) {
      Object.defineProperty(navigator, 'geolocation', original);
    } else {
      delete (navigator as { geolocation?: unknown }).geolocation;
    }
  });

  it('con una sola lectura de ±900 m no hay posición, y dice por qué', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(900);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS * 2);

    expect(await promesa).toBeNull();
    expect(ultimoMensaje()).toContain('poco precisa (±900 m)');
    expect(ultimoMensaje()).toContain('Ubicación precisa');
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('justo en el tope la lectura todavía sirve', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(PRECISION_DESCARTE_M);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);

    expect((await promesa)?.precision).toBe(PRECISION_DESCARTE_M);
  });

  it('una lectura mala no se promedia con la aproximada que llega después', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(900, -24.0532, -54.315);
    leer(60, -24.0633, -54.316);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);

    const posicion = await promesa;
    expect(posicion?.lecturas).toBe(1);
    expect(posicion?.latitud).toBe(-24.0633);
    expect(posicion?.precision).toBe(60);
  });

  it('si al principio solo informa mal, espera una ventana más y usa la buena', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(900, -24.0532, -54.315);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);
    leer(15);
    leer(15);
    await vi.advanceTimersByTimeAsync(1);

    const posicion = await promesa;
    expect(posicion?.precision).toBe(15);
    expect(posicion?.latitud).toBe(-24.0633);
    // Y no queda nada vivo: ni el watch ni el reloj de la segunda ventana.
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('una aproximada de ±60 m se devuelve al primer tope, sin esperar de más', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(60);
    let resuelta = false;
    void promesa.then(() => (resuelta = true));
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);

    expect(resuelta).toBe(true);
    expect((await promesa)?.precision).toBe(60);
    expect(ultimoMensaje()).toBe('Ubicación aproximada.');
  });

  it('dos lecturas buenas terminan sin esperar el tope', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(15);
    leer(12);
    await vi.advanceTimersByTimeAsync(1);

    const posicion = await promesa;
    expect(posicion?.lecturas).toBe(2);
    expect(posicion?.precision).toBe(12);
  });

  it('el tiempo agotado del navegador no se confunde con el permiso negado', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(CALENTAMIENTO_MS + 1);
    leer(900);
    fallar(TIEMPO_AGOTADO);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS * 2);

    expect(await promesa).toBeNull();
    expect(ultimoMensaje()).toContain('poco precisa');
    expect(ultimoMensaje()).not.toContain('permiso');
  });

  it('el permiso negado se dice como tal, y enseguida', async () => {
    const promesa = pedir();
    fallar(PERMISO_NEGADO);

    expect(await promesa).toBeNull();
    expect(ultimoMensaje()).toContain('Revisá el permiso');
  });

  it('una lectura mala que cayó en el calentamiento igual se informa, sin inventar el número', async () => {
    const promesa = new GeoService().posicionActual((p) => progresos.push(p));
    leer(900);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS * 2 + 1);

    expect(await promesa).toBeNull();
    expect(ultimoMensaje()).toContain('poco precisa.');
    expect(ultimoMensaje()).not.toContain('±');
  });

  it('sin ninguna lectura no se habla de precisión', async () => {
    const promesa = pedir();
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);

    expect(await promesa).toBeNull();
    expect(ultimoMensaje()).toContain('esté encendida');
    expect(ultimoMensaje()).not.toContain('precisa');
  });
});
