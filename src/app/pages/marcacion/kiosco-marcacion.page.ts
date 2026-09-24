import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  FRAMES_MINIMOS_VERIFICACION,
  promediarEmbeddingsConScore,
} from 'src/app/domains/marcacion/embedding-galeria.util';
import {
  AccionMarcacionPendiente,
  EstadoMarcacionUsuario,
  MarcacionInput,
  MetodoMarcacion,
  TipoMarcacion,
} from 'src/app/domains/marcacion/marcacion.model';
import { UsuarioPorEmbeddingGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioPorEmbedding';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { CapturaFacialComponent } from './captura-facial.component';
import { MarcacionService } from './marcacion.service';
import { DeteccionSucursalService } from './deteccion-sucursal.service';
import { Identificacion, RespuestaIdentificacion, validarIdentificacion } from './identificacion.util';

/** En qué punto está el kiosco. */
type FaseKiosco = 'inicio' | 'contando' | 'capturando' | 'eligiendo' | 'exito' | 'fallo';

const SEGUNDOS_CUENTA = 3;
const FRAMES_POR_FOTO = 5;
const MS_ENTRE_FRAMES = 80;
/** Cuánto queda el saludo antes de volver solo a inicio. */
const MS_SALUDO = 5000;
const MINIMO_VIDA = 0.5;

/**
 * Kiosco de marcación: un dispositivo compartido en la puerta.
 *
 * La persona toca **Marcar**, una cuenta de 3 segundos, la foto se toma sola,
 * el central dice quién es y la marcación queda **a nombre de quien la cámara
 * reconoció**. Es el flujo del `fichaje-facial` de `frc-gourmet`.
 *
 * ⚠️ **Acá el 1:N sí marca por otra persona, y en el teléfono personal no.**
 * Es la decisión de la issue #17: en un teléfono con sesión abierta, si el
 * rostro no es el del usuario en sesión se rechaza; el 1:N que marca por otro
 * vive solo acá, que es el dispositivo donde hace falta. La contrapartida es
 * que un falso positivo deja una marcación a nombre de quien no estuvo.
 *
 * ⚠️ **Doble control antes de marcar.** El central resuelve el 1:N y devuelve
 * el mejor match **sin el margen contra el segundo candidato**; acá se
 * recalcula la similitud contra la galería que vino, con el umbral de
 * verificación (`0.75`) y no el de búsqueda (`0.55`). Ver
 * {@link validarIdentificacion} y la issue #217 del central.
 *
 * ⚠️ **La posición es la de la detección, no la de cada marcación.** A
 * diferencia de la marcación personal, acá el dispositivo está fijo en una
 * pared: volver a tomar el GPS por persona agregaría hasta 6 s a cada una de
 * una fila. Se detecta al abrir y con **Recalcular**.
 *
 * ⚠️ **Lleva rol** (`kioscoMarcacion`), a diferencia de la marcación propia:
 * ver el porqué en `permisos.ts`.
 */
@Component({
  selector: 'frc-kiosco-marcacion',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    EstadoVacioComponent,
    CapturaFacialComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Marcación" [conVolver]="true">
      <frc-seccion titulo="Dónde estás" [panel]="true">
        @switch (deteccion()) {
          @case ('buscando') {
            <frc-dato etiqueta="Sucursal" [valor]="progreso()?.mensaje ?? 'Buscando la ubicación…'" />
          }
          @case ('ok') {
            <frc-dato etiqueta="Sucursal" [valor]="nombreSucursal()" />
            <frc-dato etiqueta="Distancia" [valor]="distanciaLegible()" />
          }
          @case ('sin-posicion') {
            <frc-estado-vacio
              titulo="No se pudo obtener la ubicación"
              detalle="Sin ubicación no se puede saber en qué sucursal está este dispositivo. Revisá el permiso y tocá Recalcular."
            />
          }
          @case ('sin-coordenadas') {
            <frc-estado-vacio
              titulo="No se pudo determinar la sucursal"
              detalle="Ninguna sucursal operable tiene sus coordenadas cargadas. Avisá a sistemas."
            />
          }
        }
        <div class="recalcular">
          <button matButton [disabled]="deteccion() === 'buscando'" (click)="recalcular()">
            Recalcular
          </button>
        </div>
      </frc-seccion>

      @switch (fase()) {
        @case ('inicio') {
          <div class="grande">
            <button matButton="filled" [disabled]="!listoParaMarcar()" (click)="empezar()">
              Marcar
            </button>
          </div>
        }
        @case ('exito') {
          <frc-seccion [panel]="true">
            <p class="saludo">{{ saludo() }}</p>
            <p class="detalle">{{ detalleSaludo() }}</p>
          </frc-seccion>
        }
        @default {
          <frc-seccion [panel]="true">
            <frc-captura-facial [overlay]="overlay()" (falla)="alFallarCamara($event)" />
            <p class="detalle">{{ pie() }}</p>

            @if (fase() === 'eligiendo') {
              <div class="opciones">
                <button matButton="filled" (click)="elegirSalida(true)">Salir a almorzar</button>
                <button matButton (click)="elegirSalida(false)">Marcar salida</button>
              </div>
            }
            @if (fase() === 'fallo') {
              <div class="opciones">
                <button matButton="filled" (click)="empezar()">Intentar de nuevo</button>
                <button matButton (click)="volverAInicio()">Cancelar</button>
              </div>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .recalcular {
      display: flex;
      justify-content: flex-end;
    }
    .grande {
      display: flex;
      justify-content: center;
      padding: var(--sp-4) 0;
    }
    .saludo {
      margin: 0;
      text-align: center;
      font-size: var(--fs-title);
      font-weight: var(--fw-medium);
      color: var(--text);
    }
    .detalle {
      margin: 0;
      text-align: center;
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .opciones {
      display: flex;
      justify-content: center;
      gap: var(--sp-2);
    }
  `,
})
export class KioscoMarcacionPage {
  private readonly det = inject(DeteccionSucursalService);
  private readonly datos = inject(DatosService);
  private readonly porEmbeddingGQL = inject(UsuarioPorEmbeddingGQL);
  private readonly servicio = inject(MarcacionService);
  private readonly notificacion = inject(NotificacionService);

  private readonly captura = viewChild(CapturaFacialComponent);

  readonly deteccion = this.det.estado;
  readonly progreso = this.det.progreso;

  readonly fase = signal<FaseKiosco>('inicio');
  readonly cuenta = signal(SEGUNDOS_CUENTA);
  readonly overlay = signal<string | null>(null);
  readonly motivo = signal('');
  readonly identificado = signal<Identificacion | null>(null);
  readonly saludo = signal('');
  readonly detalleSaludo = signal('');

  private estadoDeLaPersona: EstadoMarcacionUsuario | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private saludoTimer: ReturnType<typeof setTimeout> | null = null;

  readonly listoParaMarcar = computed(() => this.det.sucursal() != null);
  readonly nombreSucursal = computed(() => {
    const s = this.det.sucursal();
    return s ? String(s.nombre ?? `Sucursal ${s.id}`) : '—';
  });
  readonly distanciaLegible = computed(() => {
    const m = this.det.distancia();
    if (m == null) {
      return '—';
    }
    return m >= 1000 ? `${formatearCantidad(m / 1000, 2)} km` : `${formatearCantidad(m, 0)} m`;
  });

  constructor() {
    this.det.cargar(() => this.notificacion.warn('No se pudieron cargar las sucursales.'));
    inject(DestroyRef).onDestroy(() => this.limpiarRelojes());
  }

  pie(): string {
    switch (this.fase()) {
      case 'contando':
        return 'Mirá de frente a la cámara';
      case 'capturando':
        return 'Buscando quién sos…';
      case 'eligiendo':
        return `${this.nombreIdentificado()}, ¿salís a almorzar o terminás el día?`;
      case 'fallo':
        return this.motivo();
      default:
        return '';
    }
  }

  recalcular(): void {
    void this.det.detectar();
  }

  /** Arranca —o reintenta— la identificación. */
  empezar(): void {
    this.limpiarRelojes();
    this.motivo.set('');
    this.identificado.set(null);
    this.fase.set('contando');
    this.cuenta.set(SEGUNDOS_CUENTA);
    this.overlay.set(String(SEGUNDOS_CUENTA));

    this.reloj = setInterval(() => {
      this.cuenta.update((n) => n - 1);
      if (this.cuenta() <= 0) {
        this.detenerReloj();
        this.overlay.set(null);
        void this.identificar();
        return;
      }
      this.overlay.set(String(this.cuenta()));
    }, 1000);
  }

  /**
   * Saca la foto, pregunta al central quién es y lo comprueba acá.
   *
   * ⚠️ **«No reconocimos a nadie» y «no estamos seguros» son cosas
   * distintas.** La primera es que el rostro no está enrolado; la segunda es
   * que sí hay un candidato pero no alcanza el doble control. Decirlas igual
   * manda a registrar el rostro a alguien que ya lo tiene.
   */
  private async identificar(): Promise<void> {
    this.fase.set('capturando');

    const capturas = (await this.captura()?.capturarTanda(FRAMES_POR_FOTO, MS_ENTRE_FRAMES)) ?? [];
    const vivas = capturas.filter((c) => c.real >= MINIMO_VIDA && c.live >= MINIMO_VIDA);

    if (capturas.length && vivas.length < FRAMES_MINIMOS_VERIFICACION) {
      this.fallar('Tiene que ser un rostro real, no una foto.');
      return;
    }
    if (vivas.length < FRAMES_MINIMOS_VERIFICACION) {
      this.fallar('No te reconocimos. Poné la cara frente a la cámara y probá de nuevo.');
      return;
    }

    const embedding = promediarEmbeddingsConScore(
      vivas.map((c) => ({ embedding: c.embedding, score: c.score })),
    );
    if (!embedding) {
      this.fallar('No te reconocimos. Poné la cara frente a la cámara y probá de nuevo.');
      return;
    }

    let respuesta: RespuestaIdentificacion | null | undefined;
    try {
      respuesta = await this.datos
        .consultar<RespuestaIdentificacion>(
          this.porEmbeddingGQL,
          { embedding, excludeIds: [] },
          { mostrarCarga: false },
        )
        .toPromise();
    } catch {
      this.fallar('No se pudo consultar al central. Probá de nuevo.');
      return;
    }

    const identificacion = validarIdentificacion(embedding, respuesta);
    if (!identificacion) {
      this.fallar('No te reconocimos. ¿Tenés el rostro registrado?');
      return;
    }
    if (!identificacion.confiable) {
      this.fallar('No estamos seguros de quién sos. Probá de frente y con más luz.');
      return;
    }

    this.identificado.set(identificacion);
    this.pedirEstado(Number(identificacion.usuario.id));
  }

  /** Qué corresponde marcar lo decide el central, igual que en la propia. */
  private pedirEstado(usuarioId: number): void {
    this.servicio.estado(usuarioId).subscribe({
      next: (estado) => {
        this.estadoDeLaPersona = estado ?? null;
        if (!estado?.accionPendiente) {
          this.fallar(`${this.nombreIdentificado()}, no hay nada para marcar ahora.`);
          return;
        }
        // Con las dos salidas habilitadas la elección es de la persona: el
        // central manda los dos flags justamente para desambiguar.
        if (estado.puedeMarcarSalida === true && estado.puedeMarcarSalidaAlmuerzo === true) {
          this.fase.set('eligiendo');
          return;
        }
        this.enviar(estado.accionPendiente, false);
      },
      error: () => this.fallar('No se pudo consultar tu jornada. Probá de nuevo.'),
    });
  }

  elegirSalida(esSalidaAlmuerzo: boolean): void {
    const accion = this.estadoDeLaPersona?.accionPendiente;
    if (!accion) {
      this.fallar('No hay nada para marcar ahora.');
      return;
    }
    this.enviar(accion, esSalidaAlmuerzo);
  }

  private enviar(accion: AccionMarcacionPendiente, esSalidaAlmuerzo: boolean): void {
    const identificacion = this.identificado();
    const sucursal = this.det.sucursal();
    const posicion = this.det.posicion();
    if (!identificacion || !sucursal?.id || !posicion) {
      this.fallar('Se perdió la ubicación. Tocá Recalcular.');
      return;
    }

    // Solo ENTRADA y SALIDA existen como tipo; el matiz del almuerzo va en
    // `esSalidaAlmuerzo`, que es lo que evita que la jornada se parta en dos.
    const esSalida =
      accion === AccionMarcacionPendiente.SALIDA ||
      accion === AccionMarcacionPendiente.SALIDA_DEFINITIVA;

    const input: MarcacionInput = {
      // ⚠️ El de la persona identificada, **no** el de la sesión de la tablet.
      usuarioId: Number(identificacion.usuario.id),
      sucursalId: Number(sucursal.id),
      tipo: esSalida ? TipoMarcacion.SALIDA : TipoMarcacion.ENTRADA,
      esSalidaAlmuerzo,
      latitud: posicion.latitud,
      longitud: posicion.longitud,
      precisionGps: posicion.precision,
      distanciaSucursalMetros: this.det.distancia() ?? undefined,
      deviceInfo: navigator.userAgent,
      metodoRegistro: MetodoMarcacion.FACIAL_1AN_KIOSCO,
      similitudFacial: identificacion.similitudCentral,
      margenSegundoCandidato: identificacion.margen ?? undefined,
    };

    this.servicio.guardar(input).subscribe({
      next: () => this.saludar(esSalida),
      error: (err: Error) => this.fallar(err.message),
    });
  }

  private saludar(esSalida: boolean): void {
    const nombre = this.nombreIdentificado();
    this.saludo.set(esSalida ? `¡Hasta luego, ${nombre}!` : `¡Hola, ${nombre}!`);
    this.detalleSaludo.set(esSalida ? 'Salida registrada' : 'Entrada registrada');
    this.fase.set('exito');
    // Vuelve solo: en una puerta con fila, nadie va a tocar «listo».
    this.saludoTimer = setTimeout(() => this.volverAInicio(), MS_SALUDO);
  }

  private nombreIdentificado(): string {
    const u = this.identificado()?.usuario;
    return String(u?.persona?.nombre ?? u?.nickname ?? 'Funcionario');
  }

  alFallarCamara(motivo: string): void {
    this.fallar(motivo);
  }

  private fallar(motivo: string): void {
    this.limpiarRelojes();
    this.motivo.set(motivo);
    this.fase.set('fallo');
  }

  volverAInicio(): void {
    this.limpiarRelojes();
    this.identificado.set(null);
    this.estadoDeLaPersona = null;
    this.motivo.set('');
    this.saludo.set('');
    this.detalleSaludo.set('');
    this.fase.set('inicio');
  }

  private detenerReloj(): void {
    if (this.reloj) {
      clearInterval(this.reloj);
      this.reloj = null;
    }
  }

  private limpiarRelojes(): void {
    this.detenerReloj();
    if (this.saludoTimer) {
      clearTimeout(this.saludoTimer);
      this.saludoTimer = null;
    }
    this.overlay.set(null);
  }
}
