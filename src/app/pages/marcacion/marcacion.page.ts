import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { GeoService, PRECISION_MAXIMA_M, Posicion, ProgresoGeo } from 'src/app/core/dispositivo/geo.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { IncorporarEmbeddingMarcacionGQL } from 'src/app/graphql/personas/usuario/graphql/incorporarEmbeddingMarcacion';
import {
  DatosVerificacion,
  ResultadoVerificacion,
  VerificacionFacialDialogComponent,
} from './verificacion-facial-dialog.component';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import {
  AccionMarcacionPendiente,
  EstadoMarcacionUsuario,
  MarcacionInput,
  TipoMarcacion,
} from 'src/app/domains/marcacion/marcacion.model';
import { convertMsToTime, fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { detectarSucursal } from './deteccion-sucursal.util';
import { MarcacionService } from './marcacion.service';

/**
 * En qué punto está la detección de la sucursal.
 *
 * ⚠️ **`sin-posicion` y `sin-coordenadas` son dos respuestas distintas** y hay
 * que decirlas distinto: una es «no pude preguntar dónde estás», la otra es
 * «pregunté, pero ninguna sucursal tiene coordenadas para comparar». Juntarlas
 * en un «no se pudo» genérico manda a revisar el permiso del teléfono cuando
 * el que falta es un dato del central.
 */
type EstadoDeteccion = 'buscando' | 'ok' | 'sin-posicion' | 'sin-coordenadas';

/** Qué texto lleva el botón según lo que el backend diga que falta. */
const ETIQUETAS: Readonly<Record<AccionMarcacionPendiente, string>> = {
  [AccionMarcacionPendiente.ENTRADA]: 'Marcar entrada',
  [AccionMarcacionPendiente.SALIDA]: 'Marcar salida',
  [AccionMarcacionPendiente.RETORNO_ALMUERZO]: 'Volver del almuerzo',
  [AccionMarcacionPendiente.SALIDA_DEFINITIVA]: 'Marcar salida',
};

/**
 * Marcar entrada y salida, con validación de ubicación.
 *
 * ⚠️ **Se ofrece solo lo que el backend habilita.** Mostrar entrada y salida
 * a la vez permite dos entradas seguidas. La excepción es la primera salida
 * del día: ahí el central habilita `puedeMarcarSalida` **y**
 * `puedeMarcarSalidaAlmuerzo` a la vez —la acción `SALIDA` es ambigua a
 * propósito— y quién elige es el funcionario, con `esSalidaAlmuerzo`. Ver
 * {@link puedeElegirSalida}.
 *
 * ⚠️ **La distancia no bloquea, se registra.** El umbral de precisión de la
 * web es peor que el del plugin nativo que se reemplaza —sobre todo en
 * interiores, que es donde se marca—, así que marcar lejos avisa y pide
 * confirmación en vez de impedirlo. Lo que queda es la evidencia:
 * `precisionGps` y `distanciaSucursalMetros` viajan con la marcación y
 * permiten recalibrar el umbral con datos reales. Ver `geo.service.ts`.
 *
 * ⚠️ **La sucursal sale de la posición, no de una lista.** Mientras se elegía
 * de un desplegable, la distancia no medía nada: alcanzaba con seleccionar la
 * sucursal donde uno *dice* estar, y el aviso de «estás lejos» no aparecía
 * nunca. Por eso **sin posición no se marca**: caer en silencio a la sucursal
 * de la sesión reabriría el mismo agujero por la puerta de atrás —bastaría
 * con negar el permiso de ubicación—. Ver la issue #15.
 */
@Component({
  selector: 'frc-marcacion',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Marcación" [conVolver]="true">
      @if (accion(); as a) {
        <div acciones>
          @if (puedeElegirSalida()) {
            <button matButton [disabled]="!puedeMarcar()" (click)="marcar(true)">
              {{ enCurso() === true ? 'Marcando…' : 'Salir a almorzar' }}
            </button>
          }
          <button matButton="filled" [disabled]="!puedeMarcar()" (click)="marcar(false)">
            {{ enCurso() === false ? 'Marcando…' : ETIQUETAS[a] }}
          </button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Dónde estás" [panel]="true">
          @switch (deteccion()) {
            @case ('buscando') {
              <frc-dato etiqueta="Sucursal" [valor]="progreso()?.mensaje ?? 'Buscando tu ubicación…'" />
            }
            @case ('ok') {
              <frc-dato etiqueta="Sucursal" [valor]="nombreDetectada()" />
              <frc-dato etiqueta="Distancia" [valor]="distanciaLegible()" />
              @if (progreso()?.precisionActual; as p) {
                <frc-dato etiqueta="Precisión" [valor]="'±' + redondear(p) + ' m'" />
              }
            }
            @case ('sin-posicion') {
              <frc-estado-vacio
                titulo="No se pudo obtener la ubicación"
                [detalle]="detalleSinPosicion()"
              />
            }
            @case ('sin-coordenadas') {
              <frc-estado-vacio
                titulo="No se pudo determinar la sucursal"
                detalle="Ninguna sucursal operable tiene sus coordenadas cargadas, así que no hay contra qué comparar. Avisá a sistemas."
              />
            }
          }
          <div class="recalcular">
            <button matButton [disabled]="deteccion() === 'buscando'" (click)="detectar()">
              Recalcular
            </button>
          </div>
        </frc-seccion>

        <frc-seccion titulo="Hoy" [panel]="true">
          <frc-dato etiqueta="Estado" [valor]="resumenEstado()" />
          @if (jornada(); as j) {
            <frc-dato etiqueta="Entrada" [valor]="hora(j.marcacionEntrada?.fechaEntrada)" />
            @if (j.marcacionSalidaAlmuerzo) {
              <frc-dato etiqueta="Salió a almorzar" [valor]="hora(j.marcacionSalidaAlmuerzo.fechaSalida)" />
            }
            @if (j.marcacionEntradaAlmuerzo) {
              <frc-dato etiqueta="Volvió" [valor]="hora(j.marcacionEntradaAlmuerzo.fechaEntrada)" />
            }
            @if (j.marcacionSalida) {
              <frc-dato etiqueta="Salida" [valor]="hora(j.marcacionSalida.fechaSalida)" />
            }
            <frc-dato etiqueta="Trabajadas" [valor]="trabajadas()" />
          }
        </frc-seccion>

      }
    </frc-pagina>
  `,
  styles: `
    /* El cuerpo de frc-seccion es una columna flex y estira a sus hijos: sin
       este contenedor el botón ocuparía todo el ancho del panel. */
    .recalcular {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class MarcacionPage {
  private readonly servicio = inject(MarcacionService);
  private readonly geo = inject(GeoService);

  private readonly datos = inject(DatosService);
  private readonly incorporarGQL = inject(IncorporarEmbeddingMarcacionGQL);

  /** Lo que devolvió la verificación facial de esta marcación, si hubo. */
  private readonly verificacion = signal<ResultadoVerificacion | null>(null);
  private readonly sucursalesService = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);

  readonly ETIQUETAS = ETIQUETAS;

  readonly estado = signal<EstadoMarcacionUsuario | null>(null);
  /** Las operables, que son las únicas contra las que se mide. */
  readonly sucursales = signal<Sucursal[]>([]);
  readonly deteccion = signal<EstadoDeteccion>('buscando');
  readonly sucursalDetectada = signal<Sucursal | null>(null);
  readonly progreso = signal<ProgresoGeo | null>(null);
  readonly distancia = signal<number | null>(null);
  readonly cargando = signal(true);
  readonly marcando = signal(false);
  /**
   * `esSalidaAlmuerzo` de la marcación en vuelo, o `null` si no hay ninguna.
   *
   * Existe solo para que «Marcando…» aparezca en el botón que se tocó y no
   * en los dos a la vez.
   */
  readonly enCurso = signal<boolean | null>(null);
  readonly error = signal<string | null>(null);

  readonly jornada = computed(() => this.estado()?.jornadaRelevante ?? null);
  readonly accion = computed(() => this.estado()?.accionPendiente ?? null);
  /**
   * `true` cuando el central acepta las dos salidas y la elección es del
   * funcionario: irse a almorzar —la jornada sigue abierta— o cerrar el día.
   *
   * ⚠️ **Se lee de los dos flags, no de la acción.** `accionPendiente` vale
   * `SALIDA` en ese estado, así que deducir el tipo de ahí marcaba siempre
   * salida de almuerzo y dejaba al funcionario obligado a marcar el retorno.
   * Los flags son justamente lo que el central manda para desambiguar.
   */
  readonly puedeElegirSalida = computed(() => {
    const e = this.estado();
    return e?.puedeMarcarSalida === true && e?.puedeMarcarSalidaAlmuerzo === true;
  });
  /** Solo se marca con una sucursal detectada y sin otra marcación en vuelo. */
  readonly puedeMarcar = computed(() => !this.marcando() && this.sucursalDetectada() != null);
  readonly nombreDetectada = computed(() => {
    const s = this.sucursalDetectada();
    return s ? String(s.nombre ?? `Sucursal ${s.id}`) : '—';
  });
  readonly distanciaLegible = computed(() => {
    const m = this.distancia();
    if (m == null) {
      return '—';
    }
    // Cuatro mil metros se lee peor que 4 km, y es la escala en la que uno
    // entiende de una que está en otra sucursal.
    return m >= 1000 ? `${formatearCantidad(m / 1000, 2)} km` : `${this.redondear(m)} m`;
  });
  /**
   * Por qué no hay ubicación.
   *
   * Se prefiere el mensaje del `GeoService` —que distingue el permiso negado
   * del tiempo agotado— antes que un texto propio que diría menos.
   */
  readonly detalleSinPosicion = computed(
    () =>
      this.progreso()?.mensaje ??
      'Revisá que el permiso de ubicación esté dado y que el GPS esté encendido, y tocá Recalcular.',
  );
  readonly resumenEstado = computed(() => {
    const e = this.estado();
    if (!e) {
      return '—';
    }
    if (!e.estaEnJornada) {
      return 'Fuera de jornada';
    }
    // Con las dos salidas habilitadas no «falta» una: hay dos posibles, y
    // anunciar una de las dos empuja a marcar la que no era.
    if (this.puedeElegirSalida() || !e.accionPendiente) {
      return 'En jornada';
    }
    return `En jornada · falta ${ETIQUETAS[e.accionPendiente].toLowerCase()}`;
  });
  readonly trabajadas = computed(() => {
    const min = this.jornada()?.minutosTrabajados;
    return min != null ? convertMsToTime(min * 60_000) : '—';
  });

  constructor() {
    this.cargar();
    this.cargarSucursales();
  }

  cargar(): void {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      this.error.set('La sesión no tiene usuario.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.estado(usuarioId).subscribe({
      next: (estado) => {
        this.estado.set(estado ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  private cargarSucursales(): void {
    this.sucursalesService.todas().subscribe({
      next: (todas) => {
        this.sucursales.set(soloOperables(todas ?? []));
        void this.detectar();
      },
      error: () => {
        this.deteccion.set('sin-coordenadas');
        this.notificacion.warn('No se pudieron cargar las sucursales.');
      },
    });
  }

  /**
   * Toma la posición y resuelve en qué sucursal se está.
   *
   * Corre sola al abrir la pantalla y de nuevo con **Recalcular**. No hay
   * elección manual: si esto no resuelve, no se marca.
   */
  async detectar(): Promise<void> {
    this.deteccion.set('buscando');
    this.sucursalDetectada.set(null);
    this.distancia.set(null);

    const posicion = await this.geo.posicionActual((p) => this.progreso.set(p));
    this.aplicarPosicion(posicion);
  }

  /**
   * Deja la pantalla contando lo que la posición permite afirmar.
   *
   * Devuelve la sucursal y los metros cuando se pudo, o `null` cuando no —así
   * lo usa {@link marcar} para decidir si sigue, sin repetir el desarme.
   */
  private aplicarPosicion(posicion: Posicion | null): { sucursal: Sucursal; metros: number } | null {
    if (!posicion) {
      this.deteccion.set('sin-posicion');
      this.sucursalDetectada.set(null);
      this.distancia.set(null);
      return null;
    }

    const detectada = detectarSucursal(this.sucursales(), posicion, (latA, lngA, latB, lngB) =>
      this.geo.distanciaMetros(latA, lngA, latB, lngB),
    );
    if (!detectada) {
      this.deteccion.set('sin-coordenadas');
      this.sucursalDetectada.set(null);
      this.distancia.set(null);
      return null;
    }

    this.sucursalDetectada.set(detectada.sucursal);
    this.distancia.set(detectada.metros);
    this.deteccion.set('ok');
    return detectada;
  }

  hora(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  redondear(n: number): string {
    return formatearCantidad(n, 0);
  }

  /**
   * Toma la posición, calcula la distancia y guarda la marcación.
   *
   * La sucursal tiene que tener coordenadas cargadas para poder medir; si no
   * las tiene, se marca igual y la distancia queda sin dato — que es
   * información honesta, no un cero engañoso.
   */
  /**
   * Verifica el rostro contra la galería propia, si la persona tiene una.
   *
   * ⚠️ **No bloquea a quien todavía no enroló.** Hacerlo obligatorio de golpe
   * dejaría sin marcar a toda la gente que hoy marca sin rostro, que es
   * casi toda. Cuando el enrolamiento esté repartido, esto pasa a exigirse.
   */
  private async verificarRostro(usuarioId: number): Promise<boolean> {
    const resultado = await this.dialogo.abrir<
      VerificacionFacialDialogComponent,
      DatosVerificacion,
      ResultadoVerificacion | null
    >(VerificacionFacialDialogComponent, { usuarioId });

    if (resultado) {
      // Se guarda para mandarlo con la marcación: el central incorpora los
      // embeddings buenos a la galería y así el reconocimiento mejora con el
      // uso, en vez de quedarse con las cinco fotos del primer día.
      this.verificacion.set(resultado);
      return true;
    }

    // Cancelar o no tener rostro cargado no es un error: se ofrece marcar
    // igual, y queda registrado que fue sin verificación facial.
    this.verificacion.set(null);
    return this.dialogo.confirmar({
      titulo: 'Sin verificación facial',
      mensaje: 'No se verificó tu rostro. ¿Querés marcar igual?',
      confirmar: 'Marcar igual',
    });
  }

  /**
   * @param esSalidaAlmuerzo Qué salida se está marcando, cuando hay elección.
   *   Irrelevante en una entrada: `AlmuerzoProcessor.handleEntrada()` del
   *   central ignora el flag y decide por posición —si ya hay entrada y hay
   *   salida de almuerzo sin retorno, es el retorno—. Solo pesa en la
   *   salida, que es donde decide si la jornada cierra.
   */
  async marcar(esSalidaAlmuerzo: boolean): Promise<void> {
    const usuarioId = this.auth.usuario()?.id;
    const accion = this.accion();
    const alAbrir = this.sucursalDetectada();
    if (usuarioId == null || !accion || !alAbrir?.id) {
      this.notificacion.warn('Todavía no se sabe en qué sucursal estás. Tocá Recalcular.');
      return;
    }
    this.enCurso.set(esSalidaAlmuerzo);

    // Quién sos, antes de dónde estás. Son dos preguntas independientes y se
    // hacen en ese orden porque la cara es la que puede fallar por gusto del
    // usuario —cancelar, no tener rostro cargado— y no tiene sentido esperar
    // el GPS para descubrirlo.
    if (!(await this.verificarRostro(usuarioId))) {
      this.enCurso.set(null);
      return;
    }

    this.marcando.set(true);

    // ⚠️ **La posición se vuelve a tomar acá.** La de la apertura sirvió para
    // decir dónde estás y habilitar el botón; entre eso y el toque pueden
    // pasar minutos. Lo que se guarda como evidencia tiene que ser del
    // momento en que se marcó, no de cuando se abrió la pantalla.
    const posicion = await this.geo.posicionActual((p) => this.progreso.set(p));
    const ahora = this.aplicarPosicion(posicion);

    if (!ahora) {
      this.marcando.set(false);
      this.enCurso.set(null);
      this.notificacion.warn('Se perdió la ubicación. No se marcó nada; tocá Recalcular.');
      return;
    }

    // La persona se movió lo suficiente como para que ahora esté más cerca de
    // otra sucursal. Marcar contra la de la apertura registraría un lugar
    // donde ya no está, así que se muestra la nueva y decide de nuevo.
    if (String(ahora.sucursal.id) !== String(alAbrir.id)) {
      this.marcando.set(false);
      this.enCurso.set(null);
      this.notificacion.warn(
        `Ahora estás más cerca de ${this.nombreDetectada()}. Revisá y volvé a marcar.`,
      );
      return;
    }

    if (ahora.metros > PRECISION_MAXIMA_M) {
      const seguir = await this.dialogo.confirmar({
        titulo: 'Estás lejos de la sucursal',
        mensaje: `La ubicación da ${Math.round(ahora.metros)} m de distancia de ${this.nombreDetectada()}, con una precisión de ±${Math.round(posicion!.precision)} m. La marcación queda registrada con esos datos.`,
        confirmar: 'Marcar igual',
      });
      if (!seguir) {
        this.marcando.set(false);
        this.enCurso.set(null);
        return;
      }
    }

    this.enviar(usuarioId, accion, ahora.sucursal, posicion!, ahora.metros, esSalidaAlmuerzo);
  }

  /**
   * Suma el rostro de esta marcación a la galería del usuario.
   *
   * Es lo que hace que el reconocimiento **mejore con el uso** en vez de
   * quedarse con las cinco fotos del día del enrolamiento: la persona cambia
   * de peinado, de anteojos, de luz. El central decide si lo incorpora — por
   * eso se le manda el `score` y no se insiste si dice que no.
   *
   * ⚠️ **No bloquea ni avisa.** La marcación ya quedó registrada; que la
   * galería no se enriquezca es una mejora perdida, no un fallo que le
   * importe a quien está fichando.
   */
  private incorporarRostro(usuarioId: number): void {
    const verificacion = this.verificacion();
    if (!verificacion) {
      return;
    }
    this.verificacion.set(null);

    this.datos
      .mutar<unknown>(
        this.incorporarGQL,
        { usuarioId, embedding: verificacion.embedding, score: verificacion.score },
        { mostrarCarga: false, notificarError: false },
      )
      .subscribe({ error: () => undefined });
  }

  private enviar(
    usuarioId: number,
    accion: AccionMarcacionPendiente,
    sucursal: Sucursal,
    posicion: Posicion,
    metros: number,
    esSalidaAlmuerzo: boolean,
  ): void {
    // Solo ENTRADA y SALIDA existen como tipo; el matiz de almuerzo va en
    // `esSalidaAlmuerzo`, que es lo que evita que la jornada se parta en dos.
    const esSalida =
      accion === AccionMarcacionPendiente.SALIDA ||
      accion === AccionMarcacionPendiente.SALIDA_DEFINITIVA;

    const input: MarcacionInput = {
      usuarioId,
      sucursalId: Number(sucursal.id),
      tipo: esSalida ? TipoMarcacion.SALIDA : TipoMarcacion.ENTRADA,
      esSalidaAlmuerzo,
      latitud: posicion.latitud,
      longitud: posicion.longitud,
      precisionGps: posicion.precision,
      distanciaSucursalMetros: metros,
      deviceInfo: navigator.userAgent,
    };

    this.marcando.set(true);
    this.servicio.guardar(input).subscribe({
      next: () => {
        this.marcando.set(false);
        this.enCurso.set(null);
        this.notificacion.ok('Marcación registrada.');
        this.incorporarRostro(usuarioId);
        this.cargar();
      },
      error: (err: Error) => {
        this.marcando.set(false);
        this.enCurso.set(null);
        this.notificacion.danger(err.message);
      },
    });
  }
}
