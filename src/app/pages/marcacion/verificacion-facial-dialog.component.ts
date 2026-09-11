import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  EmbeddingGaleria,
  FRAMES_MINIMOS_VERIFICACION,
  FrameCalidadFacial,
  confirmarVerificacionFinal,
  mejorSimilitudConGaleria,
  parsearGaleriaFacial,
} from 'src/app/domains/marcacion/embedding-galeria.util';
import { GaleriaFacialGQL, UsuarioConGaleria } from 'src/app/graphql/personas/usuario/graphql/galeriaFacial';
import { UsuarioPorEmbeddingGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioPorEmbedding';
import { CapturaFacialComponent } from './captura-facial.component';
import { RespuestaIdentificacion } from './identificacion.util';

/** Lo que hay que decirle al diálogo. */
export interface DatosVerificacion {
  usuarioId: number;
}

/** Qué devuelve el diálogo cuando la persona quedó verificada. */
export interface ResultadoVerificacion {
  embedding: number[];
  score: number;
  /** La calculada en el dispositivo contra la galería propia. */
  similitud: number;
  /** La que dijo el central al identificar. Vacía si no contestó. */
  similitudCentral?: number;
  /** Cuánto le sacó al segundo candidato, si el central lo informa. */
  margen?: number | null;
}

/** En qué punto está la verificación. */
type FaseVerificacion = 'preparando' | 'contando' | 'capturando' | 'fallo' | 'error';

/** Segundos de cuenta regresiva antes de la foto. */
const SEGUNDOS_CUENTA = 3;
/** Frames de una foto, y cada cuánto se toman. Toda la tanda dura ~320 ms. */
const FRAMES_POR_FOTO = 5;
const MS_ENTRE_FRAMES = 80;
/** Intentos antes de rendirse y dejar marcar sin verificación. */
const INTENTOS_MAXIMOS = 3;
/** Por debajo de esto, lo que hay delante de la cámara no es una persona. */
const MINIMO_VIDA = 0.5;

/**
 * Verifica que quien está frente a la cámara es **el usuario en sesión**,
 * antes de dejarlo marcar.
 *
 * Es verificación **1:1 contra la galería propia**, hecha **en el
 * dispositivo**: no se manda una foto a ningún lado ni se pregunta al
 * servidor quién es. Lo único que sale de acá es el embedding consolidado,
 * y solo si la persona pasó.
 *
 * **Cuenta regresiva, foto sola y reintento**, como la PWA de gourmet. Antes
 * era verificación continua —un bucle a 12 frames por segundo esperando a que
 * la persona pasara—, sin final visible: no se sabía si faltaba un segundo o
 * si nunca iba a pasar. Ver la issue #16.
 *
 * ⚠️ **La foto es una tanda de frames, y tiene que serlo.**
 * `confirmarVerificacionFinal` exige {@link FRAMES_MINIMOS_VERIFICACION}
 * frames válidos; con un frame suelto habría que relajarla. Para la persona
 * es una foto —cuenta, obturador, listo—; adentro sigue habiendo tanda.
 *
 * ⚠️ **La regla de aceptación no se relaja.** `confirmarVerificacionFinal`
 * viene de `frc-mobile` y exige tres controles independientes; bajar
 * cualquiera de ellos convierte esto en un teatro. Si en la práctica cuesta
 * pasar, el problema es el enrolamiento —pocas poses, mala luz—, no el
 * umbral.
 *
 * ⚠️ **Los intentos se acaban.** Al tercero el diálogo cierra como cancelado
 * y la marcación sigue por el camino de «sin verificación facial» que ya
 * existe. Insistir para siempre deja a alguien sin poder marcar por una
 * cámara mala, que es un problema distinto del que esto resuelve.
 *
 * ⚠️ **La ubicación no la valida esta pantalla.** Sigue siendo trabajo de
 * `MarcacionPage` con `GeoService`: son dos preguntas distintas —quién sos y
 * dónde estás— y mezclarlas haría que aflojar una afloje la otra.
 */
@Component({
  selector: 'frc-verificacion-facial',
  standalone: true,
  imports: [MatButtonModule, CapturaFacialComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Verificá tu rostro</h2>

      @if (conGaleria()) {
        <frc-captura-facial
          [overlay]="overlay()"
          (listo)="alEstarListo()"
          (falla)="alFallarCamara($event)"
        />
      }

      <p class="pie">{{ pie() }}</p>

      <div class="acciones">
        @if (fase() === 'fallo') {
          <button matButton="filled" (click)="otraFoto()">Tomar otra foto</button>
        }
        <button matButton (click)="cancelar()">Cancelar</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    .pie { margin: 0; text-align: center; font-size: var(--fs-label); color: var(--text-soft); }
    .acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
  `,
})
export class VerificacionFacialDialogComponent {
  private readonly datos = inject(DatosService);
  private readonly galeriaGQL = inject(GaleriaFacialGQL);
  private readonly porEmbeddingGQL = inject(UsuarioPorEmbeddingGQL);
  private readonly ref =
    inject<MatDialogRef<VerificacionFacialDialogComponent, ResultadoVerificacion | null>>(
      MatDialogRef,
    );

  private readonly captura = viewChild(CapturaFacialComponent);

  readonly fase = signal<FaseVerificacion>('preparando');
  readonly cuenta = signal(SEGUNDOS_CUENTA);
  /** Por qué no pasó el último intento. Vacío mientras no haya fallado. */
  readonly motivo = signal('');
  readonly mensaje = signal('Buscando tu registro facial…');
  /**
   * Si ya se sabe que la persona tiene rostro enrolado.
   *
   * ⚠️ **La cámara no se monta hasta que esto es `true`.** Pedir permiso de
   * cámara para después decir que no había con qué comparar gasta el permiso
   * —una vez denegado, el navegador no vuelve a preguntar— por nada.
   */
  readonly conGaleria = signal(false);

  /** El número grande sobre el video, solo mientras cuenta. */
  readonly overlay = signal<string | null>(null);

  private galeria: EmbeddingGaleria | null = null;
  private usuarioId = 0;
  private intentos = 0;
  private reloj: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const datos = inject<DatosVerificacion>(MAT_DIALOG_DATA);
    this.usuarioId = datos.usuarioId;
    void this.iniciar(datos.usuarioId);
    inject(DestroyRef).onDestroy(() => this.detenerReloj());
  }

  /** El texto de abajo, que dice qué está pasando. */
  pie(): string {
    switch (this.fase()) {
      case 'contando':
        return 'Mirá de frente a la cámara';
      case 'capturando':
        return 'Verificando…';
      case 'fallo':
        return this.motivo();
      default:
        return this.mensaje();
    }
  }

  /**
   * Carga la galería del usuario. Sin galería no se enciende la cámara: pedir
   * permiso para después decir que no había con qué comparar es peor que no
   * pedirlo.
   */
  private async iniciar(usuarioId: number): Promise<void> {
    try {
      const usuario = await this.datos
        .porId<UsuarioConGaleria>(this.galeriaGQL, usuarioId, undefined, { mostrarCarga: false })
        .toPromise();

      this.galeria = parsearGaleriaFacial(usuario?.persona?.embeddingFacial);
      if (!this.galeria) {
        // Mismo mensaje que `frc-mobile`: dice qué hacer, no solo que falló.
        this.fase.set('error');
        this.mensaje.set('No tenés rostro registrado. Registralo desde Mi cuenta antes de marcar.');
        return;
      }
      this.mensaje.set('Encendiendo la cámara…');
      this.conGaleria.set(true);
    } catch {
      this.fase.set('error');
      this.mensaje.set('No se pudo leer tu registro facial.');
    }
  }

  /**
   * La cámara y los modelos están listos.
   *
   * ⚠️ **Recién acá arranca la cuenta.** Largarla al abrir el diálogo la haría
   * correr mientras se bajan 10 MB de modelos, y la foto saldría de una
   * pantalla negra.
   */
  alEstarListo(): void {
    if (this.fase() === 'preparando') {
      this.arrancarCuenta();
    }
  }

  alFallarCamara(motivo: string): void {
    this.detenerReloj();
    this.fase.set('error');
    this.mensaje.set(motivo);
  }

  private arrancarCuenta(): void {
    this.detenerReloj();
    this.motivo.set('');
    this.fase.set('contando');
    this.cuenta.set(SEGUNDOS_CUENTA);
    this.overlay.set(String(SEGUNDOS_CUENTA));

    this.reloj = setInterval(() => {
      this.cuenta.update((n) => n - 1);
      if (this.cuenta() <= 0) {
        this.detenerReloj();
        this.overlay.set(null);
        void this.sacarFoto();
        return;
      }
      this.overlay.set(String(this.cuenta()));
    }, 1000);
  }

  /**
   * Saca la foto y decide.
   *
   * Los tres motivos de rechazo se distinguen porque llevan a cosas
   * distintas: no haber salido en la foto se arregla acercándose, una foto de
   * una foto no se arregla, y no ser reconocido suele ser luz o enrolamiento.
   */
  private async sacarFoto(): Promise<void> {
    this.fase.set('capturando');

    const capturas = (await this.captura()?.capturarTanda(FRAMES_POR_FOTO, MS_ENTRE_FRAMES)) ?? [];
    if (!capturas.length) {
      this.fallar('No se detectó tu rostro. Acercate y buscá mejor luz.');
      return;
    }

    const vivas = capturas.filter((c) => c.real >= MINIMO_VIDA && c.live >= MINIMO_VIDA);
    if (vivas.length < FRAMES_MINIMOS_VERIFICACION) {
      this.fallar('Tiene que ser tu rostro real, no una foto.');
      return;
    }

    const galeria = this.galeria;
    if (!galeria) {
      this.fallar('No se detectó tu rostro. Acercate y buscá mejor luz.');
      return;
    }

    const frames: FrameCalidadFacial[] = vivas.map((c) => ({
      embedding: c.embedding,
      score: c.score,
      similitud: mejorSimilitudConGaleria(c.embedding, galeria),
    }));

    const resultado = confirmarVerificacionFinal(frames, galeria);
    if (!resultado) {
      this.fallar('No te reconocimos. Probá de frente y con más luz.');
      return;
    }

    // ⚠️ **La segunda opinión va acá, después de pasar el 1:1 y no antes.**
    // El orden es lo que hace que en un intento fallido no salga ningún
    // rostro del dispositivo: hoy lo único que se manda es el embedding
    // consolidado de alguien que ya se verificó contra su propia galería.
    const segunda = await this.segundaOpinion(resultado.embedding);
    if (segunda?.otraPersona) {
      this.fallar('El rostro reconocido no es el tuyo.');
      return;
    }

    this.ref.close({
      ...resultado,
      similitudCentral: segunda?.similitud,
      margen: segunda?.margen,
    });
  }

  /**
   * Le pregunta al central quién es el rostro que ya pasó el 1:1.
   *
   * ⚠️ **Es el caso que el 1:1 no puede ver**: un rostro que se parece lo
   * suficiente a *tu* galería pero que el central reconoce como de otra
   * persona. El 1:1 solo sabe decir «se parece a la galería con la que
   * comparé»; no sabe si se parece más a la de otro.
   *
   * ⚠️ **No bloquea si el central no contesta.** El 1:1 ya pasó: quedarse sin
   * poder marcar por un problema de red sería peor que perder una segunda
   * opinión, que es exactamente lo que es.
   *
   * ⚠️ **No se dice de quién era el rostro.** Nombrarlo revelaría quién más
   * está enrolado a cualquiera que apunte la cámara a una foto.
   */
  private async segundaOpinion(
    embedding: number[],
  ): Promise<{ otraPersona: boolean; similitud?: number; margen?: number | null } | null> {
    try {
      const respuesta = await this.datos
        .consultar<RespuestaIdentificacion>(
          this.porEmbeddingGQL,
          { embedding, excludeIds: [] },
          { mostrarCarga: false, notificarError: false },
        )
        .toPromise();

      const id = respuesta?.usuario?.id;
      if (id == null) {
        // El central no reconoció a nadie. Tampoco bloquea: puede ser que la
        // galería del usuario todavía no esté en su caché.
        return null;
      }
      return {
        otraPersona: String(id) !== String(this.usuarioId),
        similitud: respuesta?.similitud ?? undefined,
        margen: respuesta?.margen ?? null,
      };
    } catch {
      return null;
    }
  }

  private fallar(motivo: string): void {
    this.intentos++;
    if (this.intentos >= INTENTOS_MAXIMOS) {
      // Se cede al camino de «sin verificación facial» de la marcación, que
      // pregunta si se quiere marcar igual y lo deja registrado.
      this.cancelar();
      return;
    }
    this.motivo.set(motivo);
    this.fase.set('fallo');
  }

  otraFoto(): void {
    this.arrancarCuenta();
  }

  cancelar(): void {
    this.detenerReloj();
    this.ref.close(null);
  }

  private detenerReloj(): void {
    if (this.reloj) {
      clearInterval(this.reloj);
      this.reloj = null;
    }
    this.overlay.set(null);
  }
}
