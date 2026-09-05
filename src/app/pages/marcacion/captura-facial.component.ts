import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  CapturaFacial,
  ReconocimientoFacialService,
} from 'src/app/core/dispositivo/reconocimiento-facial.service';

/**
 * Cámara con detección facial en el dispositivo.
 *
 * Enciende la cámara, carga los modelos y, cuando se le pide, saca una
 * **tanda de frames** y devuelve las detecciones. **No decide nada**: no
 * compara contra ninguna galería, no habla con el central y no guarda nada.
 * Quien la usa decide qué hacer con lo que sale.
 *
 * Portado del `face-capture` de `frc-gourmet`, que ya hace esto en producción
 * sobre web, incluido su `overlayText` para la cuenta regresiva del kiosco.
 *
 * ⚠️ **Vive en `pages/marcacion/`, no en `shared/`.** Lo usan dos pantallas
 * del mismo módulo —el diálogo de verificación y, más adelante, el kiosco—,
 * y la regla de tres del repo pide tres pantallas de módulos distintos.
 *
 * ⚠️ **Camino de Safari.** `playsinline` y `muted` en el `<video>` no son
 * decoración: sin ellos iOS abre el video a pantalla completa o directamente
 * no reproduce, y no hay error que lo diga.
 */
@Component({
  selector: 'frc-captura-facial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="camara">
      <video #video autoplay playsinline muted></video>
      @if (mensaje(); as m) {
        <div class="velo"><span>{{ m }}</span></div>
      }
      @if (overlay(); as texto) {
        <div class="cuenta"><span>{{ texto }}</span></div>
      }
    </div>
  `,
  styles: `
    .camara {
      position: relative;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--surface-sunken);
      aspect-ratio: 3 / 4;
    }
    /* Espejada: la gente espera verse como en un espejo, no invertida. */
    .camara video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }
    .velo,
    .cuenta {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--on-tono);
      text-align: center;
      padding: var(--sp-4);
    }
    .velo {
      background: rgb(0 0 0 / 0.55);
      font-size: var(--fs-label);
    }
    .cuenta span {
      font-size: var(--fs-display);
      font-weight: var(--fw-bold);
      line-height: 1;
      /* Sin fondo: tapar la cara con un velo justo mientras la persona se
         acomoda es lo contrario de lo que hace falta. */
      text-shadow: 0 2px 12px rgb(0 0 0 / 0.75);
    }
  `,
})
export class CapturaFacialComponent {
  /** Texto grande sobre el video. La cuenta regresiva entra por acá. */
  readonly overlay = input<string | null>(null);

  /** La cámara y los modelos quedaron listos. Recién acá se puede capturar. */
  readonly listo = output<void>();
  /** No se pudo encender la cámara o cargar los modelos. */
  readonly falla = output<string>();

  private readonly facial = inject(ReconocimientoFacialService);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly mensaje = signal<string>('Encendiendo la cámara…');

  private stream: MediaStream | null = null;

  constructor() {
    void this.iniciar();
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  private async iniciar(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const el = this.video()?.nativeElement;
      if (el) {
        el.srcObject = this.stream;
      }

      this.mensaje.set('Preparando el reconocimiento…');
      await this.facial.cargar();

      this.mensaje.set('');
      this.listo.emit();
    } catch (err) {
      const motivo =
        (err as Error)?.name === 'NotAllowedError'
          ? 'Hace falta permitir la cámara.'
          : ((err as Error)?.message ?? 'No se pudo preparar la cámara.');
      this.mensaje.set(motivo);
      this.falla.emit(motivo);
    }
  }

  /**
   * Saca varios frames seguidos y devuelve los que tuvieron rostro.
   *
   * ⚠️ **Son varios y no uno solo a propósito.** La regla de aceptación de la
   * marcación exige una tanda de frames nítidos; con un frame suelto habría
   * que relajarla, y relajarla convierte la verificación en un trámite. Para
   * quien está frente a la cámara sigue siendo una foto: la tanda entera dura
   * menos de medio segundo.
   *
   * Los frames sin rostro **no se rellenan ni se repiten**: se devuelven
   * menos, y quien llama decide si alcanzan.
   */
  async capturarTanda(cantidad: number, msEntre: number): Promise<CapturaFacial[]> {
    const el = this.video()?.nativeElement;
    if (!el) {
      return [];
    }

    const capturas: CapturaFacial[] = [];
    for (let i = 0; i < cantidad; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, msEntre));
      }
      const captura = await this.facial.detectar(el);
      if (captura) {
        capturas.push(captura);
      }
    }
    return capturas;
  }

  private detener(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.facial.liberar();
  }
}
