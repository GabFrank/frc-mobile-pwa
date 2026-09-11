import { Injectable, signal } from '@angular/core';

/** Una detección lista para enrolar o para marcar. */
export interface CapturaFacial {
  /** Descriptor de 1024 dimensiones. */
  embedding: number[];
  /** Confianza de la detección, 0..1. */
  score: number;
  /** Anti-spoofing: probabilidad de que sea un rostro real y no una foto. */
  real: number;
  /** Liveness: probabilidad de prueba de vida. */
  live: number;
  /** Caja del rostro en el frame, `[x, y, ancho, alto]`. */
  box: [number, number, number, number];
}

/**
 * Reconocimiento facial en el dispositivo, con `@vladmandic/human`.
 *
 * Solo produce **embeddings** y señales de vida a partir de un `<video>`. El
 * matching 1:N contra la galería lo hace el central (`usuarioPorEmbedding`),
 * nunca esta clase: acá no hay forma de saber quiénes son los otros.
 *
 * Portado de `frc-gourmet`, que ya lo tiene en producción sobre web. La
 * configuración de Human es la misma que usa `frc-mobile`, y eso **no es
 * cosmético**: define el modelo `faceres` de 1024 dimensiones con el que ya
 * está construida la galería del central. Cambiarla invalida todos los
 * rostros enrolados hasta hoy.
 *
 * ⚠️ **Los modelos se sirven desde `/face-models`, no desde un CDN.**
 * `frc-mobile` los baja de `cdn.jsdelivr.net`, así que en una sucursal sin
 * salida a internet el reconocimiento facial no funciona — en un sistema
 * pensado para operar en LAN. Son ~10 MB y el service worker los cachea de
 * forma **lazy**: no se pagan al instalar la app, y después quedan offline.
 * Es el ítem 52 del TODO_TECNICO.
 *
 * ⚠️ **Human entra por `import()` dinámico**, así que vive en su propio chunk
 * y no engorda el arranque de quien nunca usa el rostro.
 */
@Injectable({ providedIn: 'root' })
export class ReconocimientoFacialService {
  /** Modelo del embedding. Se guarda junto al rostro para poder migrar. */
  static readonly MODELO = 'HUMAN-FACERES-1024';
  static readonly DIMENSION = 1024;

  /** De dónde salen los modelos. Mismo origen que la app. */
  private rutaModelos = '/face-models';

  private human: unknown = null;
  private cargando: Promise<void> | null = null;

  /** Para que la pantalla pueda mostrar «preparando el reconocimiento…». */
  readonly listo = signal(false);

  get disponible(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  /**
   * Carga Human y sus modelos. Idempotente y seguro de llamar en paralelo:
   * dos pantallas que arranquen a la vez comparten la misma promesa en vez de
   * bajar 10 MB dos veces.
   */
  async cargar(): Promise<void> {
    if (this.human) {
      return;
    }
    if (this.cargando) {
      return this.cargando;
    }
    this.cargando = this.hacerCarga();
    try {
      await this.cargando;
    } finally {
      this.cargando = null;
    }
  }

  private async hacerCarga(): Promise<void> {
    const mod = (await import('@vladmandic/human')) as unknown as Record<string, unknown>;
    const Human = (mod['Human'] ??
      (mod['default'] as Record<string, unknown> | undefined)?.['Human'] ??
      mod['default']) as new (config: unknown) => unknown;

    // Esta configuración es la misma de `frc-mobile`. Ver el aviso de arriba
    // sobre por qué no se toca: `description` es el que produce el embedding.
    const human = new Human({
      modelBasePath: this.rutaModelos,
      backend: 'webgl',
      async: true,
      warmup: 'none',
      cacheSensitivity: 0,
      filter: { enabled: true, equalization: false },
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 1, minConfidence: 0.4, return: false },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    }) as { load(): Promise<void>; warmup(): Promise<void> };

    await human.load();
    await human.warmup();
    this.human = human;
    this.listo.set(true);
  }

  /**
   * Detecta el rostro principal del frame, o `null` si no hay uno claro.
   *
   * Devuelve **un solo** rostro a propósito (`maxDetected: 1`): con dos caras
   * en cámara no hay forma de saber cuál es la que quiere marcar.
   */
  async detectar(
    fuente: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  ): Promise<CapturaFacial | null> {
    if (!this.human) {
      await this.cargar();
    }
    const human = this.human as { detect(f: unknown): Promise<{ face?: unknown[] }> };
    const resultado = await human.detect(fuente);
    const caras = (resultado?.face ?? []) as Record<string, unknown>[];
    if (!caras.length) {
      return null;
    }

    const cara = caras[0];
    const embedding = cara['embedding'] as number[] | undefined;
    if (!embedding?.length) {
      // Hay cara pero Human no pudo describirla: casi siempre es que está
      // muy lejos o muy movida. No es un error, es «probá de nuevo».
      return null;
    }

    return {
      embedding: Array.from(embedding),
      score: typeof cara['faceScore'] === 'number'
        ? (cara['faceScore'] as number)
        : ((cara['score'] as number) ?? 0),
      // `real` y `live` caen a 1 si el modelo no los devolvió: no inventar un
      // rechazo cuando la señal simplemente no está.
      real: typeof cara['real'] === 'number' ? (cara['real'] as number) : 1,
      live: typeof cara['live'] === 'number' ? (cara['live'] as number) : 1,
      box: (cara['box'] as [number, number, number, number]) ?? [0, 0, 0, 0],
    };
  }

  /**
   * Suelta la referencia para que el recolector libere los modelos.
   *
   * Human no expone un `destroy` completo. Conviene llamarlo al salir de la
   * pantalla: son varios cientos de MB de tensores en GPU.
   */
  liberar(): void {
    this.human = null;
    this.listo.set(false);
  }
}
