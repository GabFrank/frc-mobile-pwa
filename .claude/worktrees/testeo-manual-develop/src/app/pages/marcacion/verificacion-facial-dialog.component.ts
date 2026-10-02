import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReconocimientoFacialService } from 'src/app/core/dispositivo/reconocimiento-facial.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  EmbeddingGaleria,
  FrameCalidadFacial,
  HITS_CONSECUTIVOS_VERIFICACION,
  UMBRAL_SIMILITUD_VERIFICACION,
  confirmarVerificacionFinal,
  mejorSimilitudConGaleria,
  parsearGaleriaFacial,
} from 'src/app/domains/marcacion/embedding-galeria.util';
import { GaleriaFacialGQL, UsuarioConGaleria } from 'src/app/graphql/personas/usuario/graphql/galeriaFacial';

/** Lo que hay que decirle al diálogo. */
export interface DatosVerificacion {
  usuarioId: number;
}

/** Qué devuelve el diálogo cuando la persona quedó verificada. */
export interface ResultadoVerificacion {
  embedding: number[];
  score: number;
  similitud: number;
}

/** Cada cuánto se mira un frame. 12 por segundo alcanza y no funde la batería. */
const MS_ENTRE_FRAMES = 80;

/**
 * Verifica que quien está frente a la cámara es **el usuario en sesión**,
 * antes de dejarlo marcar.
 *
 * Es verificación **1:1 contra la galería propia**, hecha **en el
 * dispositivo**: no se manda una foto a ningún lado ni se pregunta al
 * servidor quién es. Lo único que sale de acá es el embedding consolidado,
 * y solo si la persona pasó.
 *
 * ⚠️ **La regla de aceptación no se relaja.** `confirmarVerificacionFinal`
 * viene de `frc-mobile` y exige tres controles independientes; bajar
 * cualquiera de ellos convierte esto en un teatro. Si en la práctica cuesta
 * pasar, el problema es el enrolamiento —pocas poses, mala luz—, no el
 * umbral.
 *
 * ⚠️ **La ubicación no la valida esta pantalla.** Sigue siendo trabajo de
 * `MarcacionPage` con `GeoService`: son dos preguntas distintas —quién sos y
 * dónde estás— y mezclarlas haría que aflojar una afloje la otra.
 */
@Component({
  selector: 'frc-verificacion-facial',
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Verificá tu rostro</h2>

      <div class="camara">
        <video #video autoplay playsinline muted></video>
        @if (estado() !== 'buscando') {
          <div class="velo"><span>{{ mensaje() }}</span></div>
        }
        <!-- Los aciertos consecutivos, para que se vea que está progresando. -->
        <div class="hits">
          @for (i of [].constructor(hitsNecesarios); track $index; let idx = $index) {
            <span class="hit" [class.hecho]="idx < hits()"></span>
          }
        </div>
      </div>

      <p class="pie">{{ mensaje() }}</p>

      <div class="acciones">
        <button matButton (click)="cancelar()">Cancelar</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    .camara {
      position: relative;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--surface-sunken);
      aspect-ratio: 3 / 4;
    }
    .camara video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    .velo {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgb(0 0 0 / 0.55);
      color: var(--on-tono);
      font-size: var(--fs-label);
      text-align: center;
      padding: var(--sp-4);
    }
    .hits {
      position: absolute;
      left: 0;
      right: 0;
      bottom: var(--sp-3);
      display: flex;
      gap: var(--sp-2);
      justify-content: center;
    }
    .hit {
      width: var(--sp-3);
      height: var(--sp-3);
      border-radius: var(--radius-full);
      background: rgb(255 255 255 / 0.35);
    }
    .hit.hecho { background: var(--ok-fill); }
    .pie { margin: 0; text-align: center; font-size: var(--fs-label); color: var(--text-soft); }
    .acciones { display: flex; justify-content: flex-end; }
  `,
})
export class VerificacionFacialDialogComponent {
  private readonly facial = inject(ReconocimientoFacialService);
  private readonly datos = inject(DatosService);
  private readonly galeriaGQL = inject(GaleriaFacialGQL);
  private readonly ref =
    inject<MatDialogRef<VerificacionFacialDialogComponent, ResultadoVerificacion | null>>(
      MatDialogRef,
    );
  private readonly destroyRef = inject(DestroyRef);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly hitsNecesarios = HITS_CONSECUTIVOS_VERIFICACION;
  readonly hits = signal(0);
  readonly estado = signal<'preparando' | 'buscando' | 'error'>('preparando');
  readonly mensaje = signal('Preparando…');

  private galeria: EmbeddingGaleria | null = null;
  private frames: FrameCalidadFacial[] = [];
  private stream: MediaStream | null = null;
  private corriendo = false;

  constructor() {
    const datos = inject<DatosVerificacion>(MAT_DIALOG_DATA);
    void this.iniciar(datos.usuarioId);
    this.destroyRef.onDestroy(() => this.detener());
  }

  private async iniciar(usuarioId: number): Promise<void> {
    try {
      this.mensaje.set('Buscando tu registro facial…');
      const usuario = await this.datos
        .porId<UsuarioConGaleria>(this.galeriaGQL, usuarioId, undefined, { mostrarCarga: false })
        .toPromise();

      this.galeria = parsearGaleriaFacial(usuario?.persona?.embeddingFacial);
      if (!this.galeria) {
        // Mismo mensaje que `frc-mobile`: dice qué hacer, no solo que falló.
        this.estado.set('error');
        this.mensaje.set('No tenés rostro registrado. Registralo desde Mi cuenta antes de marcar.');
        return;
      }

      this.mensaje.set('Encendiendo la cámara…');
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

      this.estado.set('buscando');
      this.mensaje.set('Mirá de frente a la cámara');
      this.corriendo = true;
      void this.bucle();
    } catch (err) {
      this.estado.set('error');
      this.mensaje.set(
        (err as Error)?.name === 'NotAllowedError'
          ? 'Hace falta permitir la cámara para marcar con el rostro.'
          : ((err as Error)?.message ?? 'No se pudo preparar la verificación.'),
      );
    }
  }

  /**
   * Mira frames hasta juntar los aciertos consecutivos que hacen falta.
   *
   * ⚠️ **Los aciertos tienen que ser consecutivos.** Un fallo reinicia la
   * cuenta y descarta los frames: si se permitiera acumular aciertos sueltos,
   * bastaría con insistir un rato frente a la cámara con la foto de otro.
   */
  private async bucle(): Promise<void> {
    while (this.corriendo) {
      const el = this.video()?.nativeElement;
      if (!el || el.readyState < 2) {
        await this.esperar();
        continue;
      }

      const captura = await this.facial.detectar(el);
      if (!captura || !this.galeria) {
        this.fallar('Acercate y buscá mejor luz');
        await this.esperar();
        continue;
      }

      const similitud = mejorSimilitudConGaleria(captura.embedding, this.galeria);

      if (captura.real < 0.5 || captura.live < 0.5) {
        this.fallar('Tiene que ser tu rostro real, no una foto');
        await this.esperar();
        continue;
      }

      if (similitud < UMBRAL_SIMILITUD_VERIFICACION) {
        this.fallar('No te reconocemos todavía');
        await this.esperar();
        continue;
      }

      this.frames.push({ embedding: captura.embedding, score: captura.score, similitud });
      this.hits.update((n) => n + 1);
      this.mensaje.set('Quedate quieto…');

      if (this.hits() >= HITS_CONSECUTIVOS_VERIFICACION) {
        const resultado = confirmarVerificacionFinal(this.frames, this.galeria);
        if (resultado) {
          this.corriendo = false;
          this.detener();
          this.ref.close(resultado);
          return;
        }
        // Los aciertos alcanzaron pero el consolidado no: se empieza de nuevo
        // en vez de aceptar algo que la regla rechazó.
        this.fallar('Casi. Probemos de nuevo');
      }

      await this.esperar();
    }
  }

  private fallar(motivo: string): void {
    this.hits.set(0);
    this.frames = [];
    this.mensaje.set(motivo);
  }

  private esperar(): Promise<void> {
    return new Promise((r) => setTimeout(r, MS_ENTRE_FRAMES));
  }

  private detener(): void {
    this.corriendo = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.facial.liberar();
  }

  cancelar(): void {
    this.detener();
    this.ref.close(null);
  }
}
