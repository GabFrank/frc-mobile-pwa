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
 * La detección no terminó a tiempo.
 *
 * No es «no hay cara» (`null`): es «no se pudo analizar», y la pantalla lo
 * trata como un intento fallido en vez de quedarse esperando.
 */
export class DeteccionFallidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'DeteccionFallidaError';
  }
}

/** Tope del precalentamiento. Si se pasa, se sigue sin él. */
const MS_LIMITE_PRECALENTAMIENTO = 15_000;
/** Tope de una detección con el modelo ya precalentado. */
const MS_LIMITE_DETECCION = 5_000;
/** Tope si el precalentamiento no terminó: el primer detect compila la GPU. */
const MS_LIMITE_DETECCION_EN_FRIO = 15_000;

/**
 * La promesa, o un `DeteccionFallidaError` si pasa `ms`.
 *
 * ⚠️ **No cancela nada**: Human no se puede cortar y sigue en la GPU. Sirve
 * para que la pantalla no espere para siempre una promesa que no va a
 * resolver —el `detect` y el `warmup` de Human son executors async sin `try`:
 * si algo tira adentro, quedan pendientes—. No rescata un bloqueo sincrónico
 * del hilo: eso lo evita el precalentamiento.
 */
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new DeteccionFallidaError('La detección no respondió a tiempo.')), ms);
  });
  return Promise.race([promesa, vencido]).finally(() => clearTimeout(reloj));
}

/**
 * Reconocimiento facial en el dispositivo, con `@vladmandic/human`.
 *
 * Solo produce **embeddings** y señales de vida a partir de un `<video>`. El
 * matching 1:N contra la galería lo hace el central (`usuarioPorEmbedding`),
 * nunca esta clase: acá no hay forma de saber quiénes son los otros.
 *
 * Portado de `frc-gourmet`, que ya lo tiene en producción sobre web. El modelo
 * es el `faceres` de 1024 dimensiones con el que está construida la galería
 * del central: cambiarlo invalida todos los rostros enrolados.
 *
 * ⚠️ **Corre en wasm, como el desktop y `frc-mobile`, no en WebGL** (issue
 * #144). En WebGL, la GPU de algunos celulares calcula con precisión reducida
 * y `faceres` devuelve casi el mismo vector para cualquier cara: 26 personas
 * enroladas así quedaron con galerías que se parecen entre sí al 95 %, y el
 * 1:N no las distingue. Wasm calcula en la CPU con float32 exacto, da el mismo
 * embedding que el desktop y es lo que hacía `frc-mobile`. WebGL queda solo
 * como respaldo si wasm no arranca.
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
  /** Si el último `warmup` terminó: decide el tope de la primera detección. */
  private precalentado = false;
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

  /** `wasm` o `webgl`, el que quedó andando. Para diagnosticar desde la consola. */
  backendActivo: 'wasm' | 'webgl' | null = null;

  /**
   * La configuración de Human. Igual a la del desktop en lo que define el
   * embedding: detector con `rotation` (endereza la cara antes de describirla),
   * malla y `faceres`. Antispoof y liveness no tocan el embedding.
   */
  private configuracion(backend: 'wasm' | 'webgl'): Record<string, unknown> {
    return {
      modelBasePath: this.rutaModelos,
      backend,
      // Absoluta, como en el desktop: tfjs arma la URL de cada `.wasm` pegándole el nombre.
      wasmPath: new URL(`${this.rutaModelos}/tfjs-wasm/`, globalThis.location?.origin ?? 'http://localhost').href,
      async: true,
      // El precalentamiento se pide abajo, con tope: ver `hacerCarga`.
      warmup: 'none',
      cacheSensitivity: 0,
      filter: { enabled: true, equalization: false },
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 1, minConfidence: 0.4, return: false },
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
    };
  }

  private async hacerCarga(): Promise<void> {
    const mod = (await import('@vladmandic/human')) as unknown as Record<string, unknown>;
    const Human = (mod['Human'] ??
      (mod['default'] as Record<string, unknown> | undefined)?.['Human'] ??
      mod['default']) as new (config: unknown) => unknown;

    type HumanCargado = {
      load(): Promise<void>;
      warmup(config?: unknown): Promise<unknown>;
      tf?: { getBackend?(): string };
    };
    let human: HumanCargado | null = null;
    for (const backend of ['wasm', 'webgl'] as const) {
      try {
        const candidato = new Human(this.configuracion(backend)) as HumanCargado;
        await candidato.load();
        const activo = candidato.tf?.getBackend?.();
        if (activo && activo !== backend) {
          throw new Error(`Human quedó en ${activo} en vez de ${backend}`);
        }
        human = candidato;
        this.backendActivo = backend;
        if (backend !== 'wasm') {
          console.warn('[ReconocimientoFacial] wasm no arrancó: se usa WebGL, que en algunos celulares es impreciso.');
        }
        break;
      } catch (error) {
        console.warn(`[ReconocimientoFacial] No se pudo iniciar ${backend}`, error);
      }
    }
    if (!human) {
      throw new Error('No se pudo iniciar el reconocimiento facial.');
    }

    // ⚠️ **Sin esto la GPU se prepara en la primera foto**: con `'none'`,
    // `warmup()` vuelve sin hacer nada y la compilación de shaders cae justo
    // al terminar la cuenta regresiva, que se queda congelada en el «1». Acá
    // corre mientras la pantalla dice «Preparando el reconocimiento…». Solo
    // usa una imagen embebida en Human y no toca el embedding.
    this.precalentado = await conLimite(
      human.warmup({ warmup: 'face' }),
      MS_LIMITE_PRECALENTAMIENTO,
    ).then(
      // Human resuelve con `error` en vez de rechazar: eso tampoco precalentó.
      (r) => !(r as { error?: unknown } | undefined)?.error,
      () => false,
    );
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
    const resultado = await conLimite(
      human.detect(fuente),
      this.precalentado ? MS_LIMITE_DETECCION : MS_LIMITE_DETECCION_EN_FRIO,
    );
    // Un `error` de Human (p. ej. el video todavía no tiene frame) llega sin
    // caras y vuelve `null`, como siempre: se pierde ese frame, no la tanda.
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
    this.precalentado = false;
    this.listo.set(false);
  }
}
