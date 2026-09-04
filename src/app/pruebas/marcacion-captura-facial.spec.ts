import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturaFacial, ReconocimientoFacialService } from '../core/dispositivo/reconocimiento-facial.service';
import { DatosService } from '../core/graphql/datos.service';
import { GaleriaFacialGQL } from '../graphql/personas/usuario/graphql/galeriaFacial';
import { VerificacionFacialDialogComponent } from '../pages/marcacion/verificacion-facial-dialog.component';

/**
 * La verificación facial de la marcación: cuenta regresiva, foto sola y
 * reintento, como la PWA de gourmet.
 *
 * Antes era **verificación continua**: un bucle a 12 frames por segundo que
 * esperaba a que la persona pasara los tres controles, sin final visible y sin
 * un reintento planteado como tal. Ver la issue #16.
 *
 * ⚠️ **La captura es una tanda de frames, no un frame suelto**, y eso no es un
 * detalle de implementación: `confirmarVerificacionFinal` exige tres frames
 * válidos y la issue prohíbe relajarla. Para quien marca es una foto; adentro
 * sigue habiendo tanda, y los tres controles intactos.
 */
describe('Verificación facial con cuenta regresiva', () => {
  /** Vectores cortos: lo que importa es el coseno, no la dimensión real. */
  const ROSTRO = [1, 0, 0, 0, 0, 0, 0, 0];
  const OTRA_PERSONA = [0, 1, 0, 0, 0, 0, 0, 0];

  const GALERIA = JSON.stringify({
    master: ROSTRO,
    gallery: [{ pose: 'front', embedding: ROSTRO, score: 0.9 }],
  });

  const captura = (cambios: Partial<CapturaFacial> = {}): CapturaFacial => ({
    embedding: ROSTRO,
    score: 0.9,
    real: 0.9,
    live: 0.9,
    box: [0, 0, 10, 10],
    ...cambios,
  });

  let cerrar: ReturnType<typeof vi.fn>;
  let detener: ReturnType<typeof vi.fn>;
  let detectar: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let galeriaGuardada: string | null;
  /** Resuelve la carga de modelos, para poder probar que la cuenta la espera. */
  let terminarCarga: () => void;

  const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  function streamFalso(): MediaStream {
    const pista = { stop: detener };
    return { getTracks: () => [pista], getVideoTracks: () => [pista] } as unknown as MediaStream;
  }

  const crear = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { usuarioId: 42 } },
        { provide: MatDialogRef, useValue: { close: cerrar } },
        { provide: GaleriaFacialGQL, useValue: {} },
        {
          provide: DatosService,
          useValue: {
            porId: () => of({ persona: { embeddingFacial: galeriaGuardada } }),
          },
        },
        {
          provide: ReconocimientoFacialService,
          useValue: {
            cargar: () => new Promise<void>((r) => (terminarCarga = r)),
            detectar,
            liberar: vi.fn(),
          },
        },
      ],
    });
    const f = TestBed.createComponent(VerificacionFacialDialogComponent);
    f.detectChanges();
    return f;
  };

  /** Vacía la cola de microtareas sin mover el reloj. */
  const microtareas = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  };

  /** Adelanta el reloj `ms` y repinta. */
  const asentar = async (f: { detectChanges: () => void }, ms = 0) => {
    await microtareas();
    if (ms > 0) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await microtareas();
    f.detectChanges();
  };

  /**
   * Deja que la cuenta llegue a cero y que la tanda de frames termine.
   *
   * ⚠️ **Son dos tramos, no uno.** La tanda arranca recién cuando la cuenta
   * termina y usa temporizadores propios: adelantar solo los 3 s deja los
   * frames a medio sacar y el test mira un estado que todavía no existe.
   */
  const sacarFoto = async (f: { detectChanges: () => void }) => {
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(600);
    await microtareas();
    f.detectChanges();
  };

  /** Monta, deja lista la cámara y los modelos, y devuelve el fixture. */
  const listo = async () => {
    const f = crear();
    await asentar(f);
    terminarCarga();
    await asentar(f);
    return f;
  };

  const tocar = async (f: { nativeElement: HTMLElement; detectChanges: () => void }, etiqueta: string) => {
    const boton = Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.textContent ?? '').trim() === etiqueta,
    );
    expect(boton, `no existe el botón «${etiqueta}»`).toBeTruthy();
    boton!.click();
    await asentar(f);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cerrar = vi.fn();
    detener = vi.fn();
    galeriaGuardada = GALERIA;
    detectar = vi.fn(() => Promise.resolve(captura()));
    getUserMedia = vi.fn(() => Promise.resolve(streamFalso()));

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    // jsdom no reproduce video ni expone un readyState útil.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      get: () => 4,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original) {
      Object.defineProperty(navigator, 'mediaDevices', original);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    }
  });

  it('la cuenta no arranca hasta que la cámara y los modelos están listos', async () => {
    const f = crear();

    await asentar(f, 5000);

    // Si arrancara antes, la cuenta correría mientras se bajan 10 MB de
    // modelos y la foto saldría de una pantalla negra.
    expect(f.componentInstance.fase()).toBe('preparando');
    expect(detectar).not.toHaveBeenCalled();
  });

  it('con todo listo, la cuenta empieza sola', async () => {
    const f = await listo();

    expect(f.componentInstance.fase()).toBe('contando');
    expect(f.componentInstance.cuenta()).toBe(3);
  });

  it('la cuenta baja segundo a segundo', async () => {
    const f = await listo();

    await asentar(f, 1000);
    expect(f.componentInstance.cuenta()).toBe(2);

    await asentar(f, 1000);
    expect(f.componentInstance.cuenta()).toBe(1);
  });

  it('la cuenta se ve en pantalla', async () => {
    const f = await listo();

    expect(f.nativeElement.textContent).toContain('3');
  });

  it('a cero la foto se toma sola, sin que nadie toque un botón', async () => {
    const f = await listo();

    await sacarFoto(f);

    expect(detectar).toHaveBeenCalled();
  });

  it('capturar es una tanda de frames, no un frame suelto', async () => {
    const f = await listo();

    await sacarFoto(f);

    // `confirmarVerificacionFinal` pide tres frames válidos; con uno solo
    // habría que relajarla, que es justo lo que la issue prohíbe.
    expect(detectar.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('una verificación buena cierra con el embedding consolidado', async () => {
    const f = await listo();

    await sacarFoto(f);

    expect(cerrar).toHaveBeenCalledTimes(1);
    const resultado = cerrar.mock.calls[0][0];
    expect(resultado.embedding.length).toBe(ROSTRO.length);
    expect(resultado.similitud).toBeGreaterThanOrEqual(0.75);
    expect(resultado.score).toBeGreaterThan(0);
  });

  it('no queda ningún bucle mirando frames después de capturar', async () => {
    const f = await listo();
    await sacarFoto(f);
    const despuesDeCapturar = detectar.mock.calls.length;

    await asentar(f, 5000);

    expect(detectar.mock.calls.length).toBe(despuesDeCapturar);
  });

  it('sin rostro en la foto no cierra: ofrece tomar otra', async () => {
    detectar.mockResolvedValue(null);
    const f = await listo();

    await sacarFoto(f);

    expect(f.componentInstance.fase()).toBe('fallo');
    expect(f.componentInstance.motivo()).toContain('rostro');
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('la foto de una foto no pasa, y dice por qué', async () => {
    detectar.mockResolvedValue(captura({ real: 0.1, live: 0.1 }));
    const f = await listo();

    await sacarFoto(f);

    expect(f.componentInstance.fase()).toBe('fallo');
    expect(f.componentInstance.motivo()).toContain('real');
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('si es otra persona no cierra, y lo dice', async () => {
    detectar.mockResolvedValue(captura({ embedding: OTRA_PERSONA }));
    const f = await listo();

    await sacarFoto(f);

    expect(f.componentInstance.fase()).toBe('fallo');
    expect(f.componentInstance.motivo()).toContain('reconoc');
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('«Tomar otra foto» reinicia la cuenta', async () => {
    detectar.mockResolvedValue(null);
    const f = await listo();
    await sacarFoto(f);

    await tocar(f, 'Tomar otra foto');

    expect(f.componentInstance.fase()).toBe('contando');
    expect(f.componentInstance.cuenta()).toBe(3);
  });

  it('el reintento vuelve a capturar solo, sin tocar nada más', async () => {
    detectar.mockResolvedValue(null);
    const f = await listo();
    await sacarFoto(f);
    const antes = detectar.mock.calls.length;

    await tocar(f, 'Tomar otra foto');
    await sacarFoto(f);

    expect(detectar.mock.calls.length).toBeGreaterThan(antes);
  });

  it('los intentos se acaban: al tercero cierra sin verificación', async () => {
    detectar.mockResolvedValue(null);
    const f = await listo();

    await sacarFoto(f);
    await tocar(f, 'Tomar otra foto');
    await sacarFoto(f);
    await tocar(f, 'Tomar otra foto');
    await sacarFoto(f);

    // Insistir para siempre deja a la persona sin poder marcar; se cede al
    // camino de «sin verificación facial», que la marcación ya contempla.
    expect(cerrar).toHaveBeenCalledWith(null);
  });

  it('cancelar cierra sin verificación', async () => {
    const f = crear();
    await asentar(f);

    await tocar(f, 'Cancelar');

    expect(cerrar).toHaveBeenCalledWith(null);
  });

  it('sin rostro registrado no se enciende la cámara', async () => {
    galeriaGuardada = null;

    const f = crear();
    await asentar(f);

    expect(f.componentInstance.fase()).toBe('error');
    expect(f.nativeElement.textContent).toContain('Mi cuenta');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('al cerrar suelta la cámara', async () => {
    const f = await listo();

    f.destroy();

    expect(detener).toHaveBeenCalled();
  });
});
