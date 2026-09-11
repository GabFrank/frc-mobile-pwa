import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { IconoComponent } from 'src/app/shared/icono/icono.component';
import {
  DetectorDeCodigos,
  FORMATOS_PRODUCTO,
  FORMATO_ZXING,
  OpcionesEscaneo,
  detectorNativo,
  hayCamara,
} from './escaner.types';

/**
 * Cada cuánto se le pide una lectura al detector, en milisegundos.
 *
 * La implementación de referencia de `frc-gourmet` usa `requestAnimationFrame`,
 * o sea hasta 60 intentos por segundo. Un lector de supermercado apunta y
 * espera; 12 por segundo se siente igual de instantáneo y no tiene al teléfono
 * a full con la cámara abierta —que es justo cuando la batería importa—.
 */
const INTERVALO_MS = 80;

type Estado = 'iniciando' | 'escaneando' | 'manual';

/**
 * Escáner de códigos con la cámara.
 *
 * Tres caminos, en orden:
 *
 * 1. **`BarcodeDetector`** — API del navegador, presente en Chromium. Por
 *    debajo es ML Kit: el mismo motor que usaba el plugin de Capacitor del
 *    repo anterior.
 * 2. **ZXing** — para **Safari y Firefox**, que no traen `BarcodeDetector` y
 *    no está previsto que lo traigan. Es el camino de iOS. Entra por
 *    `import()` dinámico, así que Chromium nunca descarga esos kilobytes.
 * 3. **Carga manual** — siempre disponible, no solo cuando algo falla. Un
 *    código térmico gastado no se lee ni con el mejor motor, y el cajero
 *    necesita poder seguir.
 *
 * ⚠️ **iOS no es un caso futuro: es uno de los motivos de la migración.**
 * Soportar iPhone es lo que la APK no podía dar. Cualquier capacidad nueva
 * de dispositivo necesita su camino en Safari, aunque hoy no haya ningún
 * iPhone en la flota. Ver la regla 7 en `CLAUDE.md`.
 */
@Component({
  selector: 'frc-escaner-dialog',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="escaner">
      <video
        #video
        class="video"
        [class.oculto]="estado() !== 'escaneando'"
        playsinline
        muted
        autoplay
      ></video>

      @if (estado() === 'escaneando') {
        <div class="guia" aria-hidden="true">
          <div class="marco"></div>
          <p class="ayuda">{{ ayuda }}</p>
        </div>
      }

      @if (estado() === 'iniciando') {
        <div class="centro">
          <frc-icono nombre="camara" [tamano]="48" />
          <p>Abriendo la cámara…</p>
        </div>
      }

      @if (estado() === 'manual') {
        <div class="centro manual">
          <frc-icono nombre="escanear" [tamano]="48" />
          <p class="motivo">{{ motivo() }}</p>

          <mat-form-field appearance="outline" class="campo">
            <mat-label>{{ etiquetaManual }}</mat-label>
            <input
              matInput
              cdkFocusInitial
              [value]="codigoManual()"
              (input)="alEscribir($event)"
              (keydown.enter)="confirmarManual()"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </mat-form-field>

          <button
            matButton="filled"
            [disabled]="!codigoManual().trim()"
            (click)="confirmarManual()"
          >
            Confirmar
          </button>
        </div>
      }

      <header class="barra">
        <button type="button" class="icono-btn" (click)="cancelar()" aria-label="Cerrar">
          <frc-icono nombre="cerrar" [tamano]="22" />
        </button>
        <h1>{{ titulo }}</h1>
        @if (puedeLinterna()) {
          <button
            type="button"
            class="icono-btn"
            [class.encendida]="linterna()"
            (click)="alternarLinterna()"
            [attr.aria-pressed]="linterna()"
            aria-label="Linterna"
          >
            <frc-icono nombre="linterna" [tamano]="22" />
          </button>
        }
      </header>

      @if (estado() === 'escaneando') {
        <footer class="pie">
          <button matButton class="claro" (click)="pasarAManual()">Ingresar a mano</button>
        </footer>
      }
    </div>
  `,
  styles: `
    .escaner {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video.oculto { display: none; }

    .barra {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      padding-top: max(var(--sp-3), env(safe-area-inset-top));
      color: #fff;
      background: linear-gradient(rgb(0 0 0 / 0.55), transparent);
    }
    .barra h1 {
      flex: 1;
      margin: 0;
      font-size: var(--fs-title);
      font-weight: var(--fw-medium);
    }
    .icono-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: var(--sp-1);
      border-radius: var(--radius-sm);
      line-height: 0;
    }
    .icono-btn.encendida { color: var(--warn-fill); }

    .guia {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    /*
      El sombreado de fuera del marco se hace con un box-shadow enorme y no
      con cuatro divs: es una sola capa, no se desalinea y no cuesta layout.
    */
    .marco {
      width: 78%;
      max-width: 320px;
      aspect-ratio: 3 / 2;
      border: 2px solid rgb(255 255 255 / 0.9);
      border-radius: var(--radius-md);
      box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.4);
    }
    .ayuda {
      margin-top: var(--sp-4);
      color: #fff;
      font-weight: var(--fw-medium);
      text-align: center;
      padding: 0 var(--sp-4);
    }

    .centro {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      padding: var(--sp-5);
      text-align: center;
      color: var(--text-mute);
    }
    .manual {
      background: var(--bg);
      color: var(--text);
    }
    .motivo { margin: 0; color: var(--text-soft); }
    .campo { width: 100%; max-width: 320px; }

    .pie {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: grid;
      padding: var(--sp-4);
      padding-bottom: max(var(--sp-4), env(safe-area-inset-bottom));
    }
    .claro { --mat-button-text-label-text-color: #fff; }
  `,
})
export class EscanerDialogComponent {
  private readonly datos = inject<OpcionesEscaneo>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly ref = inject<MatDialogRef<EscanerDialogComponent, string | undefined>>(
    MatDialogRef,
  );
  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly titulo = this.datos.titulo ?? 'Escanear';
  readonly ayuda = this.datos.ayuda ?? 'Apuntá al código';
  readonly etiquetaManual = this.datos.etiquetaManual ?? 'Código';

  readonly estado = signal<Estado>('iniciando');
  readonly motivo = signal('');
  readonly codigoManual = signal('');
  readonly linterna = signal(false);
  private readonly capacidadLinterna = signal(false);
  readonly puedeLinterna = computed(
    () => this.estado() === 'escaneando' && this.capacidadLinterna(),
  );

  private stream: MediaStream | null = null;
  private detector: DetectorDeCodigos | null = null;
  private controlesZxing: { stop(): void } | null = null;
  private cerrado = false;

  constructor() {
    // El diálogo se destruye cuando se cierra, y con él tiene que irse la
    // cámara: un stream sin liberar deja el led del teléfono prendido y el
    // usuario cree que la app lo sigue filmando.
    inject(DestroyRef).onDestroy(() => this.detener());
    void this.iniciar();
  }

  /**
   * Abre la cámara y arranca el motor de lectura que corresponda.
   *
   * La cámara se pide **una sola vez, acá**, y recién después se decide el
   * motor. Así el permiso, la traducción de errores y la linterna son los
   * mismos por los dos caminos: lo único que cambia entre Android e iOS es
   * quién mira los frames.
   */
  private async iniciar(): Promise<void> {
    if (!hayCamara()) {
      this.pasarAManual('Este navegador no da acceso a la cámara.');
      return;
    }

    const formatos = [...(this.datos.formatos ?? FORMATOS_PRODUCTO)];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      this.pasarAManual(this.explicar(err));
      return;
    }

    const video = this.videoRef().nativeElement;
    video.srcObject = this.stream;
    try {
      // iOS exige `playsinline` y `muted` —los dos están en la plantilla—,
      // y aun así puede rechazar el play si no viene de un gesto. El
      // diálogo se abre desde un clic, así que el gesto está.
      await video.play();
    } catch {
      /* algunos navegadores reproducen igual con autoplay */
    }

    this.capacidadLinterna.set(this.soportaLinterna());

    const arrancado = (await this.arrancarNativo(formatos)) || (await this.arrancarZxing(formatos));
    if (!arrancado) {
      this.pasarAManual('Este navegador no puede leer códigos con la cámara.');
      return;
    }

    this.estado.set('escaneando');
  }

  /** `BarcodeDetector`. Chromium, Android incluido. */
  private async arrancarNativo(formatos: string[]): Promise<boolean> {
    const Detector = detectorNativo();
    if (!Detector) {
      return false;
    }
    try {
      const usables = await this.formatosUsables(Detector, formatos);
      if (usables.length === 0) {
        return false;
      }
      this.detector = new Detector({ formats: usables });
      void this.bucle();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ZXing en WebAssembly/JS, para **Safari y Firefox**.
   *
   * iOS no tiene `BarcodeDetector` y no está previsto que lo tenga. Sin este
   * camino, un iPhone solo podría cargar códigos a mano — y soportar iOS es
   * de los motivos por los que esta app dejó de ser una APK.
   *
   * Se carga con `import()` dinámico: queda en un chunk aparte que Chromium
   * nunca descarga.
   */
  private async arrancarZxing(formatos: string[]): Promise<boolean> {
    if (!this.stream) {
      return false;
    }
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);

      const posibles = formatos
        .map((f) => BarcodeFormat[FORMATO_ZXING[f] as keyof typeof BarcodeFormat])
        .filter((f) => f !== undefined);

      const pistas = new Map();
      if (posibles.length > 0) {
        // Sin acotar los formatos, ZXing prueba todos los decodificadores en
        // cada frame: en un teléfono se nota.
        pistas.set(DecodeHintType.POSSIBLE_FORMATS, posibles);
      }

      const lector = new BrowserMultiFormatReader(pistas);
      this.controlesZxing = await lector.decodeFromStream(
        this.stream,
        this.videoRef().nativeElement,
        (resultado) => {
          const texto = resultado?.getText();
          if (texto) {
            this.emitir(texto);
          }
          // El callback también se invoca sin resultado en cada frame que no
          // trae código. No es un error: es lo normal mientras se apunta.
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Intersecta lo pedido con lo que el navegador declara soportar.
   *
   * Sin esto el constructor de `BarcodeDetector` puede rechazar la lista
   * entera por un solo formato desconocido, y se pierde el escaneo completo
   * por algo que no hacía falta.
   */
  private async formatosUsables(
    Detector: { getSupportedFormats?(): Promise<string[]> },
    pedidos: string[],
  ): Promise<string[]> {
    if (!Detector.getSupportedFormats) {
      return pedidos;
    }
    const soportados = await Detector.getSupportedFormats();
    return pedidos.filter((f) => soportados.includes(f));
  }

  /**
   * Pide una lectura cada `INTERVALO_MS` hasta encontrar algo o cerrarse.
   *
   * Salta los intentos con la pestaña en segundo plano: el `<video>` no
   * entrega frames nuevos y detectar sobre el último congelado es puro gasto.
   */
  private async bucle(): Promise<void> {
    const video = this.videoRef().nativeElement;

    while (!this.cerrado && this.detector) {
      if (video.readyState >= 2 && document.visibilityState === 'visible') {
        try {
          const codigos = await this.detector.detect(video);
          const valor = codigos?.[0]?.rawValue;
          if (valor) {
            this.emitir(String(valor));
            return;
          }
        } catch {
          /* frame ilegible: se sigue con el siguiente */
        }
      }
      await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS));
    }
  }

  private soportaLinterna(): boolean {
    const pista = this.stream?.getVideoTracks()[0];
    const capacidades = pista?.getCapabilities?.() as { torch?: boolean } | undefined;
    return capacidades?.torch === true;
  }

  async alternarLinterna(): Promise<void> {
    const pista = this.stream?.getVideoTracks()[0];
    if (!pista) {
      return;
    }
    const proximo = !this.linterna();
    try {
      // `torch` es una restricción avanzada: no está en los tipos de
      // MediaTrackConstraintSet, pero es la única forma de prender el flash.
      await pista.applyConstraints({ advanced: [{ torch: proximo }] } as never);
      this.linterna.set(proximo);
    } catch {
      // Algunos teléfonos declaran la capacidad y después la rechazan.
      this.capacidadLinterna.set(false);
    }
  }

  /** Traduce el error de `getUserMedia` a algo que el usuario pueda accionar. */
  private explicar(err: unknown): string {
    const nombre = (err as { name?: string } | null)?.name;
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
      return 'No diste permiso para usar la cámara.';
    }
    if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
      return 'No se encontró una cámara en este dispositivo.';
    }
    if (nombre === 'NotReadableError') {
      return 'Otra aplicación está usando la cámara.';
    }
    return 'No se pudo abrir la cámara.';
  }

  pasarAManual(motivo = 'Cargá el código a mano.'): void {
    this.detener();
    this.motivo.set(motivo);
    this.estado.set('manual');
  }

  alEscribir(evento: Event): void {
    this.codigoManual.set((evento.target as HTMLInputElement).value);
  }

  confirmarManual(): void {
    const codigo = this.codigoManual().trim();
    if (codigo) {
      this.emitir(codigo);
    }
  }

  cancelar(): void {
    this.cerrado = true;
    this.detener();
    this.ref.close(undefined);
  }

  private emitir(codigo: string): void {
    if (this.cerrado) {
      return;
    }
    this.cerrado = true;
    this.detener();
    this.ref.close(codigo);
  }

  private detener(): void {
    this.detector = null;
    if (this.controlesZxing) {
      // Corta el bucle de decodificación de ZXing. Sin esto sigue leyendo
      // frames aunque el diálogo ya no exista.
      try {
        this.controlesZxing.stop();
      } catch {
        /* ya estaba detenido */
      }
      this.controlesZxing = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((pista) => pista.stop());
      this.stream = null;
    }
    this.linterna.set(false);
  }
}
