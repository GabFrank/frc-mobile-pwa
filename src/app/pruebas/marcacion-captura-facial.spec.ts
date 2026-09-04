import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturaFacial, ReconocimientoFacialService } from '../core/dispositivo/reconocimiento-facial.service';
import { DatosService } from '../core/graphql/datos.service';
import { GaleriaFacialGQL } from '../graphql/personas/usuario/graphql/galeriaFacial';
import { UsuarioPorEmbeddingGQL } from '../graphql/personas/usuario/graphql/usuarioPorEmbedding';
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
        { provide: UsuarioPorEmbeddingGQL, useValue: {} },
        {
          provide: DatosService,
          useValue: {
            porId: () => of({ persona: { embeddingFacial: galeriaGuardada } }),
            // La segunda opinión del central: acá coincide con la sesión, así
            // que no cambia nada de lo que estos casos prueban.
            consultar: () => of({ usuario: { id: 42 }, similitud: 0.9 }),
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

  /**
   * Monta, deja lista la cámara y los modelos, y devuelve el fixture.
   *
   * ⚠️ **Dos tandas antes de `terminarCarga`, no una.** La galería llega
   * primero, recién ahí se monta la cámara, y recién cuando `getUserMedia`
   * resuelve se llama a `cargar()` — que es lo que deja `terminarCarga` en
   * pie. Con una sola tanda estos casos pasaban usando el `terminarCarga`
   * que había dejado el test anterior, así que dependían del orden.
   */
  const listo = async () => {
    const f = crear();
    await asentar(f);
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
    terminarCarga = () => {
      throw new Error('cargar() todavía no se llamó: falta dejar correr la cámara');
    };
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

/**
 * La segunda opinión del central, en el teléfono personal.
 *
 * ⚠️ **El 1:1 sigue siendo la puerta, y corre primero.** Recién cuando la
 * persona pasó contra su propia galería se le pregunta al central quién es.
 * El orden importa por dos cosas: no se manda ningún rostro al servidor en
 * los intentos fallidos —hoy no sale nada del dispositivo salvo que la
 * verificación haya pasado—, y la regla de aceptación no se toca.
 *
 * Lo que agrega el 1:N acá es el caso que el 1:1 no puede ver: un rostro que
 * se parece lo suficiente a **tu** galería, pero que el central reconoce como
 * de otra persona. Ver el alcance A de la issue #17.
 */
describe('Verificación facial: la segunda opinión del central', () => {
  const ROSTRO = [1, 0, 0, 0, 0, 0, 0, 0];
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
  let detectar: ReturnType<typeof vi.fn>;
  let consultar: ReturnType<typeof vi.fn>;
  let identificado: unknown;
  let terminarCarga: () => void;

  const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  const microtareas = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const crear = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { usuarioId: 42 } },
        { provide: MatDialogRef, useValue: { close: cerrar } },
        { provide: GaleriaFacialGQL, useValue: {} },
        { provide: UsuarioPorEmbeddingGQL, useValue: {} },
        {
          provide: DatosService,
          useValue: {
            porId: () => of({ persona: { embeddingFacial: GALERIA } }),
            consultar,
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

  const asentar = async (f: { detectChanges: () => void }) => {
    await microtareas();
    await vi.advanceTimersByTimeAsync(0);
    await microtareas();
    f.detectChanges();
  };

  const listo = async () => {
    const f = crear();
    // Tres tandas y no una: la galería llega, recién ahí se monta la cámara,
    // y recién cuando `getUserMedia` resuelve se llama a `cargar()` — que es
    // lo que deja `terminarCarga` en pie.
    await asentar(f);
    await asentar(f);
    terminarCarga();
    await asentar(f);
    return f;
  };

  const sacarFoto = async (f: { detectChanges: () => void }) => {
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(600);
    await microtareas();
    f.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cerrar = vi.fn();
    detectar = vi.fn(() => Promise.resolve(captura()));
    terminarCarga = () => {
      throw new Error('cargar() todavía no se llamó: falta dejar correr la cámara');
    };
    // Por defecto, el central coincide: es el mismo usuario de la sesión.
    identificado = { usuario: { id: 42, persona: { embeddingFacial: GALERIA } }, similitud: 0.9, margen: 0.31 };
    consultar = vi.fn(() => of(identificado));

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }) },
      configurable: true,
    });
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

  it('no se le pregunta al central hasta que el 1:1 pasó', async () => {
    detectar.mockResolvedValue(null);
    const f = await listo();

    await sacarFoto(f);

    // Un intento fallido no manda ningún rostro a ningún lado.
    expect(consultar).not.toHaveBeenCalled();
  });

  it('si el central reconoce a otra persona, no verifica', async () => {
    identificado = { usuario: { id: 7, persona: { embeddingFacial: GALERIA } }, similitud: 0.92 };
    const f = await listo();

    await sacarFoto(f);

    expect(cerrar).not.toHaveBeenCalled();
    expect(f.componentInstance.fase()).toBe('fallo');
  });

  it('no dice de quién es el rostro que reconoció', async () => {
    identificado = {
      usuario: { id: 7, nickname: 'FULANO', persona: { nombre: 'Fulano de Tal', embeddingFacial: GALERIA } },
      similitud: 0.92,
    };
    const f = await listo();

    await sacarFoto(f);

    // Nombrarlo revelaría quién más está enrolado, a cualquiera que apunte la
    // cámara a una foto.
    expect(f.componentInstance.motivo()).not.toContain('Fulano');
  });

  it('si coincide con la sesión, verifica y devuelve la similitud del central', async () => {
    const f = await listo();

    await sacarFoto(f);

    expect(cerrar).toHaveBeenCalledTimes(1);
    const resultado = cerrar.mock.calls[0][0];
    expect(resultado.similitudCentral).toBeCloseTo(0.9);
    expect(resultado.margen).toBeCloseTo(0.31);
  });

  it('si el central no contesta, no bloquea: el 1:1 ya pasó', async () => {
    consultar = vi.fn(() => {
      throw new Error('sin red');
    });
    const f = await listo();

    await sacarFoto(f);

    // Quedarse sin marcar por un problema de red sería peor que perder la
    // segunda opinión, que es justamente una segunda opinión.
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(cerrar.mock.calls[0][0].similitudCentral).toBeUndefined();
  });

  it('si el central no reconoce a nadie, tampoco bloquea', async () => {
    identificado = null;
    const f = await listo();

    await sacarFoto(f);

    expect(cerrar).toHaveBeenCalledTimes(1);
  });
});
