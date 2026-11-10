import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DeteccionFallidaError,
  ReconocimientoFacialService,
} from '../core/dispositivo/reconocimiento-facial.service';

/**
 * Los topes de tiempo de Human: que una GPU colgada no deje la marcación
 * trabada en la cuenta regresiva.
 *
 * ⚠️ **Human se mockea entero.** El `detect` y el `warmup` de verdad son
 * executors async sin `try`: si algo tira adentro, la promesa no resuelve
 * nunca. Eso es lo que se simula con una promesa que nunca resuelve.
 */
const human = {
  load: vi.fn(() => Promise.resolve()),
  warmup: vi.fn((_config?: unknown): Promise<unknown> => Promise.resolve()),
  detect: vi.fn((_fuente?: unknown): Promise<unknown> => Promise.resolve({ face: [] })),
};

vi.mock('@vladmandic/human', () => ({
  Human: function Human() {
    return human;
  },
}));

const nunca = () => new Promise<never>(() => undefined);
const video = {} as HTMLVideoElement;

describe('Reconocimiento facial: topes de tiempo', () => {
  let servicio: ReconocimientoFacialService;

  beforeEach(() => {
    vi.useFakeTimers();
    human.load.mockClear();
    human.warmup.mockReset().mockResolvedValue(undefined);
    human.detect.mockReset().mockResolvedValue({ face: [] });
    servicio = new ReconocimientoFacialService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('precalienta el modelo de rostro al cargar, antes de la primera foto', async () => {
    await servicio.cargar();

    // Con `'none'` la GPU se preparaba en la primera foto y congelaba la
    // cuenta en el «1».
    expect(human.warmup).toHaveBeenCalledWith({ warmup: 'face' });
  });

  it('si el precalentamiento no termina, la carga sigue igual', async () => {
    human.warmup.mockImplementation(nunca);

    const carga = servicio.cargar();
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(carga).resolves.toBeUndefined();
    expect(servicio.listo()).toBe(true);
  });

  it('una detección que no responde corta a los 5 s con DeteccionFallidaError', async () => {
    await servicio.cargar();
    human.detect.mockImplementation(nunca);

    const deteccion = servicio.detectar(video);
    const resultado = expect(deteccion).rejects.toBeInstanceOf(DeteccionFallidaError);
    await vi.advanceTimersByTimeAsync(5_000);

    await resultado;
  });

  it('sin precalentamiento la primera detección tiene más margen', async () => {
    human.warmup.mockImplementation(nunca);
    const carga = servicio.cargar();
    await vi.advanceTimersByTimeAsync(15_000);
    await carga;

    let lista = false;
    human.detect.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ face: [] }), 10_000)),
    );
    const deteccion = servicio.detectar(video).then((c) => {
      lista = true;
      return c;
    });
    await vi.advanceTimersByTimeAsync(10_000);

    // Compilar la GPU en frío puede tardar más que una foto normal.
    await expect(deteccion).resolves.toBeNull();
    expect(lista).toBe(true);
  });

  it('si Human resuelve con un error, no lo presenta como «no hay cara»', async () => {
    await servicio.cargar();
    human.detect.mockResolvedValue({ face: [], error: 'could not convert input to tensor' });

    await expect(servicio.detectar(video)).rejects.toBeInstanceOf(DeteccionFallidaError);
  });

  it('sin cara en el frame devuelve null, no un error', async () => {
    await servicio.cargar();

    await expect(servicio.detectar(video)).resolves.toBeNull();
  });
});
