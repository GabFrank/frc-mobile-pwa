import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GANANCIA_MAXIMA,
  aplicarGanancia,
  gananciaParaLuz,
  luminanciaMedia,
  zonaCentral,
} from '../core/dispositivo/luz-facial';
import { ReconocimientoFacialService } from '../core/dispositivo/reconocimiento-facial.service';

/**
 * Poca luz y contraluz en la marcación facial: la cara oscura se aclara antes
 * de describirla. Los números están medidos en `luz-facial.ts`.
 */
describe('Luz facial: cuánto aclarar', () => {
  it('con luz suficiente no toca el frame', () => {
    expect(gananciaParaLuz(80)).toBeNull();
    expect(gananciaParaLuz(130)).toBeNull();
  });

  it('una cara oscura se lleva a ~130', () => {
    expect(gananciaParaLuz(65)).toBeCloseTo(2, 5);
  });

  it('la ganancia tiene tope: más amplifica el ruido y pierde la cara', () => {
    expect(gananciaParaLuz(5)).toBe(GANANCIA_MAXIMA);
    expect(gananciaParaLuz(0)).toBe(GANANCIA_MAXIMA);
  });

  it('una medición inválida no aclara', () => {
    expect(gananciaParaLuz(Number.NaN)).toBeNull();
  });

  it('mide la luminancia de píxeles RGBA', () => {
    expect(luminanciaMedia([255, 255, 255, 255, 0, 0, 0, 255])).toBeCloseTo(127.5, 1);
    expect(luminanciaMedia([])).toBe(0);
  });

  it('aplica la ganancia sin pasarse de 255 ni tocar el alfa', () => {
    const px = new Uint8ClampedArray([20, 100, 200, 128]);
    aplicarGanancia(px, 2);
    expect(Array.from(px)).toEqual([40, 200, 255, 128]);
  });

  it('sin cara vista mide el centro del frame', () => {
    expect(zonaCentral(640, 480)).toEqual([160, 96, 320, 288]);
  });
});

const human = {
  load: vi.fn(() => Promise.resolve()),
  warmup: vi.fn((_c?: unknown): Promise<unknown> => Promise.resolve()),
  detect: vi.fn((_f?: unknown): Promise<unknown> => Promise.resolve({ face: [] })),
};
vi.mock('@vladmandic/human', () => ({
  Human: function Human() {
    return human;
  },
}));

const frameAclarado = vi.fn();

const cara = (marca: number, box = [10, 20, 100, 120]) => ({
  embedding: [marca, 0, 0],
  faceScore: 0.9,
  real: 0.9,
  live: 0.9,
  box,
});
const video = {} as HTMLVideoElement;
const lienzo = { aclarado: true } as unknown as HTMLCanvasElement;

describe('Reconocimiento facial: poca luz', () => {
  let servicio: ReconocimientoFacialService;

  beforeEach(async () => {
    human.detect.mockReset();
    frameAclarado.mockReset().mockReturnValue(null);
    servicio = new ReconocimientoFacialService();
    servicio.aclarar = frameAclarado;
    await servicio.cargar();
  });

  it('con buena luz usa el frame original y detecta una sola vez', async () => {
    human.detect.mockResolvedValue({ face: [cara(1)] });

    const c = await servicio.detectar(video);

    expect(c?.embedding[0]).toBe(1);
    expect(human.detect).toHaveBeenCalledTimes(1);
    // Mide la luz sobre la caja de la cara, no sobre el frame entero.
    expect(frameAclarado).toHaveBeenCalledWith(video, [10, 20, 100, 120]);
  });

  it('con la cara oscura describe el frame aclarado', async () => {
    frameAclarado.mockReturnValue(lienzo);
    human.detect.mockImplementation((f) =>
      Promise.resolve({ face: [cara(f === lienzo ? 2 : 1)] }),
    );

    const c = await servicio.detectar(video);

    expect(c?.embedding[0]).toBe(2);
  });

  it('sin cara a oscuras, aclara midiendo el centro y la encuentra', async () => {
    frameAclarado.mockReturnValue(lienzo);
    human.detect.mockImplementation((f) => Promise.resolve({ face: f === lienzo ? [cara(2)] : [] }));

    const c = await servicio.detectar(video);

    expect(frameAclarado).toHaveBeenCalledWith(video, null);
    expect(c?.embedding[0]).toBe(2);
  });

  it('si el aclarado pierde la cara, se queda con la original', async () => {
    frameAclarado.mockReturnValue(lienzo);
    human.detect.mockImplementation((f) => Promise.resolve({ face: f === lienzo ? [] : [cara(1)] }));

    const c = await servicio.detectar(video);

    expect(c?.embedding[0]).toBe(1);
  });

  it('una cara sin embedding cuenta como no vista', async () => {
    human.detect.mockResolvedValue({ face: [{ ...cara(1), embedding: [] }] });

    await expect(servicio.detectar(video)).resolves.toBeNull();
    expect(frameAclarado).toHaveBeenCalledWith(video, null);
  });
});
