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
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import {
  CapturaFacial,
  ReconocimientoFacialService,
} from 'src/app/core/dispositivo/reconocimiento-facial.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  SCORE_MINIMO_GALERIA,
  construirGaleriaDesdeCapturas,
  serializarGaleriaFacial,
} from 'src/app/domains/marcacion/embedding-galeria.util';
import { SaveUsuarioImageGQL } from 'src/app/graphql/personas/usuario/graphql/saveUsuarioImage';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

/**
 * Cuántas capturas arman la galería.
 *
 * `frc-mobile` pide exactamente **3**, guiadas y en orden fijo —izquierda,
 * derecha, frente—. `frc-gourmet`, que ya corre esto en web, deja capturar
 * **libremente hasta 5**. Se toma el enfoque de gourmet con el piso más alto:
 * más muestras hacen una galería mejor, y que el usuario elija el ángulo es
 * más rápido que obedecer tres pasos.
 *
 * `construirGaleriaDesdeCapturas` acepta N: las que exceden las poses con
 * nombre entran como `pose-4`, `pose-5`. El formato que guarda el central no
 * cambia.
 */
const CAPTURAS_REQUERIDAS = 5;

/** Sugerencias que rotan, para que las tomas no salgan todas iguales. */
const SUGERENCIAS = [
  'Mirá de frente a la cámara',
  'Girá un poco a la izquierda',
  'Girá un poco a la derecha',
  'Levantá un poco el mentón',
  'Volvé al frente, con expresión natural',
] as const;

/**
 * Registro del rostro para marcar entrada.
 *
 * Cinco capturas desde ángulos distintos arman una **galería**: la marcación
 * después compara contra las cinco, no contra una sola foto, que es lo que
 * hace que funcione con otra luz o con la cabeza girada.
 *
 * El ángulo lo elige el usuario, con una sugerencia que rota. Es el enfoque
 * de `frc-gourmet` —captura libre y seguida— en vez de los tres pasos
 * obligados de `frc-mobile`: más rápido de completar y con más muestras.
 *
 * ⚠️ **El formato de la galería es el que ya guarda el central.**
 * `construirGaleriaDesdeCapturas` y `serializarGaleriaFacial` vienen
 * **verbatim** de `frc-mobile`: inventar otro formato dejaría fuera de juego
 * todos los rostros enrolados hasta hoy y la marcación empezaría a no
 * reconocer a nadie.
 *
 * ⚠️ **Nada de esto sale del teléfono como imagen para comparar.** Lo que
 * viaja es el embedding —números— más una foto frontal para que la persona
 * se reconozca en su perfil. El matching 1:N lo hace el central.
 *
 * A diferencia de `frc-mobile`, que saca las fotos con la cámara de
 * Capacitor, acá el video corre en vivo y la captura sale del frame: se ve
 * lo que se está por guardar, y funciona igual en Safari.
 */
@Component({
  selector: 'frc-enroll-facial',
  standalone: true,
  imports: [PaginaComponent, EstadoErrorComponent, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Registrar mi rostro" [conVolver]="true" [conEscaner]="false">
      @if (error(); as e) {
        <frc-estado-error [detalle]="e" (reintentar)="iniciar()" />
      } @else {
        <div class="camara">
          <!--
            playsinline y muted no son opcionales: sin ellos, iOS abre el
            video a pantalla completa en su propio reproductor y no hay frame
            que capturar.
          -->
          <video #video autoplay playsinline muted></video>
          @if (!listo()) {
            <div class="velo">
              <span>{{ preparando() }}</span>
            </div>
          }
        </div>

        <!--
          Puntos y no pasos con nombre: el ángulo lo elige el usuario, así que
          etiquetarlos «izquierda/derecha» mentiría sobre lo que hace falta.
        -->
        <div class="pasos">
          @for (i of [].constructor(requeridas); track $index; let idx = $index) {
            <span class="punto" [class.hecho]="idx < capturas().length"></span>
          }
          <span class="progreso">{{ progreso() }}</span>
        </div>

        <p class="instruccion">{{ instruccion() }}</p>

        @if (aviso(); as a) {
          <p class="aviso">{{ a }}</p>
        }

      }

      <!--
        ⚠️ La barra de acciones va **fuera** del @else y con su propio @if.
        Un bloque de control de flujo con más de un nodo raíz no proyecta a un
        slot: Angular avisa con NG8011 y el botón cae en el cuerpo de la
        página en vez de la barra fija. Un @if con un solo nodo sí proyecta.
      -->
      @if (!error()) {
        <div acciones>
          <button matButton="filled" [disabled]="!listo() || ocupado()" (click)="capturar()">
            {{ etiquetaBoton() }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .camara {
      position: relative;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--surface-sunken);
      aspect-ratio: 3 / 4;
    }
    .camara video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* Espejado: uno se ve como en un espejo, si no girar a la izquierda
         se siente al revés. */
      transform: scaleX(-1);
    }
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

    .pasos { display: flex; gap: var(--sp-2); justify-content: center; align-items: center; }
    .punto {
      width: var(--sp-3);
      height: var(--sp-3);
      border-radius: var(--radius-full);
      background: var(--surface-sunken);
      border: 1px solid var(--border);
    }
    .punto.hecho { background: var(--ok-fill); border-color: var(--ok-fill); }
    .progreso {
      margin-left: var(--sp-2);
      font-size: var(--fs-caption);
      color: var(--text-mute);
      font-variant-numeric: tabular-nums;
    }

    .instruccion {
      margin: 0;
      text-align: center;
      font-size: var(--fs-title);
      color: var(--text);
    }
    .aviso {
      margin: 0;
      text-align: center;
      font-size: var(--fs-label);
      color: var(--warn);
    }
  `,
})
export class EnrollFacialPage {
  private readonly facial = inject(ReconocimientoFacialService);
  private readonly auth = inject(AuthService);
  private readonly datos = inject(DatosService);
  private readonly guardarGQL = inject(SaveUsuarioImageGQL);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly requeridas = CAPTURAS_REQUERIDAS;
  readonly capturas = signal<CapturaFacial[]>([]);
  readonly listo = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly preparando = signal('Preparando la cámara…');

  private stream: MediaStream | null = null;
  /** La última foto frontal, que queda como imagen de perfil. */
  private fotoFrontal: string | null = null;

  readonly instruccion = computed(
    () => SUGERENCIAS[this.capturas().length] ?? 'Una más y listo',
  );

  /** «2 de 5». Sin esto no se sabe cuánto falta. */
  readonly progreso = computed(() => `${this.capturas().length} de ${CAPTURAS_REQUERIDAS}`);

  readonly etiquetaBoton = computed(() => {
    if (this.ocupado()) {
      return 'Procesando…';
    }
    return this.capturas().length === CAPTURAS_REQUERIDAS - 1 ? 'Capturar y guardar' : 'Capturar';
  });

  constructor() {
    this.iniciar();
    this.destroyRef.onDestroy(() => this.detener());
  }

  async iniciar(): Promise<void> {
    this.error.set(null);

    if (!this.facial.disponible) {
      this.error.set('Este dispositivo no tiene cámara disponible para el navegador.');
      return;
    }

    try {
      this.preparando.set('Encendiendo la cámara…');
      this.stream = await navigator.mediaDevices.getUserMedia({
        // Cámara frontal: es la que uno se apunta a sí mismo.
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const el = this.video()?.nativeElement;
      if (el) {
        el.srcObject = this.stream;
      }

      // Los modelos son ~10 MB la primera vez. Se avisa, porque en una
      // conexión lenta esto tarda y una pantalla quieta parece colgada.
      this.preparando.set('Preparando el reconocimiento… (la primera vez descarga los modelos)');
      await this.facial.cargar();
      this.listo.set(true);
    } catch (err) {
      const mensaje = (err as Error)?.name === 'NotAllowedError'
        ? 'Hace falta permitir el uso de la cámara para registrar el rostro.'
        : ((err as Error)?.message ?? 'No se pudo preparar el reconocimiento.');
      this.error.set(mensaje);
      this.detener();
    }
  }

  private detener(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.facial.liberar();
  }

  async capturar(): Promise<void> {
    const el = this.video()?.nativeElement;
    if (!el || this.ocupado()) {
      return;
    }

    this.ocupado.set(true);
    this.aviso.set(null);

    try {
      const captura = await this.facial.detectar(el);

      if (!captura) {
        this.aviso.set('No se detectó un rostro. Acercate y buscá mejor luz.');
        return;
      }
      if (captura.score < SCORE_MINIMO_GALERIA) {
        // El umbral es el del sistema, no uno inventado acá: una captura
        // pobre envenena la galería y hace fallar la marcación después.
        this.aviso.set('La imagen no quedó lo bastante nítida. Probá de nuevo.');
        return;
      }
      if (captura.real < 0.5 || captura.live < 0.5) {
        this.aviso.set('Parece una foto de una pantalla. Tiene que ser tu rostro real.');
        return;
      }

      const nuevas = [...this.capturas(), captura];
      this.capturas.set(nuevas);

      if (nuevas.length === CAPTURAS_REQUERIDAS) {
        this.fotoFrontal = this.tomarFoto(el);
        await this.guardar(nuevas);
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Frame actual como JPEG en base64, para la foto de perfil. */
  private tomarFoto(video: HTMLVideoElement): string {
    const lienzo = document.createElement('canvas');
    lienzo.width = video.videoWidth || 640;
    lienzo.height = video.videoHeight || 480;
    lienzo.getContext('2d')?.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', 0.85);
  }

  private async guardar(capturas: CapturaFacial[]): Promise<void> {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      this.notificacion.danger('La sesión no tiene usuario.');
      return;
    }

    const galeria = construirGaleriaDesdeCapturas(capturas);
    if (!galeria) {
      // La utilidad rechaza el conjunto cuando la calidad no alcanza. Se
      // vuelve a empezar entero: mezclar una captura buena con dos malas es
      // peor que repetir.
      this.notificacion.warn('Las capturas no tienen calidad suficiente. Empecemos de nuevo.');
      this.capturas.set([]);
      return;
    }

    this.datos
      .mutar<boolean>(this.guardarGQL, {
        id: usuarioId,
        type: 'perfil',
        image: this.fotoFrontal ?? '',
        embedding: galeria.master,
        embeddingGaleriaJson: serializarGaleriaFacial(galeria),
      })
      .subscribe({
        next: (ok) => {
          if (ok) {
            this.notificacion.ok('Rostro registrado. Ya podés marcar con la cara.');
            void this.router.navigate(['/cuenta']);
          } else {
            this.notificacion.danger('El servidor no aceptó el registro.');
            this.capturas.set([]);
          }
        },
        error: () => this.capturas.set([]),
      });
  }
}
