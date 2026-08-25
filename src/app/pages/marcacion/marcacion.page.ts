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
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { MarcacionService } from './marcacion.service';

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
 */
@Component({
  selector: 'frc-marcacion',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    SelectorComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Marcación" [conVolver]="true">
      @if (accion(); as a) {
        <div acciones>
          @if (puedeElegirSalida()) {
            <button matButton [disabled]="marcando()" (click)="marcar(true)">
              {{ enCurso() === true ? 'Marcando…' : 'Salir a almorzar' }}
            </button>
          }
          <button matButton="filled" [disabled]="marcando()" (click)="marcar(false)">
            {{ enCurso() === false ? 'Marcando…' : ETIQUETAS[a] }}
          </button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Sucursal" [panel]="true">
          <frc-selector
            etiqueta="Dónde estás marcando"
            [opciones]="opcionesSucursal()"
            [valor]="sucursalId()"
            (valorChange)="elegirSucursal($event)"
          />
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

        @if (progreso(); as p) {
          <frc-seccion titulo="Ubicación" [panel]="true">
            <frc-dato etiqueta="Estado" [valor]="p.mensaje" />
            @if (p.precisionActual != null) {
              <frc-dato etiqueta="Precisión" [valor]="'±' + redondear(p.precisionActual) + ' m'" />
            }
            @if (distancia() != null) {
              <frc-dato etiqueta="Distancia" [valor]="redondear(distancia()!) + ' m'" />
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
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
  readonly sucursales = signal<Sucursal[]>([]);
  readonly sucursalId = signal<unknown>(null);
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
  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.sucursales().map((s) => ({ valor: s.id, texto: String(s.nombre ?? `Sucursal ${s.id}`) })),
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
        const locales = soloOperables(todas ?? []);
        this.sucursales.set(locales);
        // La última elegida gana sobre la de la sesión: el funcionario marca
        // donde trabaja, que no siempre es la de su usuario.
        const persistida = this.servicio.sucursalPersistida()?.id;
        const deLaSesion = this.auth.sucursal()?.id;
        const elegida =
          locales.find((s) => String(s.id) === String(persistida)) ??
          locales.find((s) => String(s.id) === String(deLaSesion)) ??
          locales[0];
        this.sucursalId.set(elegida?.id ?? null);
      },
      error: () => this.notificacion.warn('No se pudieron cargar las sucursales.'),
    });
  }

  elegirSucursal(id: unknown): void {
    this.sucursalId.set(id);
    const elegida = this.sucursales().find((s) => String(s.id) === String(id)) ?? null;
    this.servicio.guardarSucursal(elegida);
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
    const sucursal = this.sucursales().find((s) => String(s.id) === String(this.sucursalId()));
    if (usuarioId == null || !accion || !sucursal?.id) {
      this.notificacion.warn('Elegí la sucursal donde estás marcando.');
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
    this.distancia.set(null);

    const posicion = await this.geo.posicionActual((p) => this.progreso.set(p));
    if (!posicion) {
      this.marcando.set(false);
      const seguir = await this.dialogo.confirmar({
        titulo: 'Sin ubicación',
        mensaje: 'No se pudo obtener la ubicación. ¿Marcar igual? Va a quedar registrado sin GPS.',
        confirmar: 'Marcar igual',
      });
      if (!seguir) {
        this.enCurso.set(null);
        return;
      }
      this.enviar(usuarioId, accion, sucursal, null, null, esSalidaAlmuerzo);
      return;
    }

    const metros = this.distanciaA(sucursal, posicion);
    this.distancia.set(metros);

    if (metros != null && metros > PRECISION_MAXIMA_M) {
      const seguir = await this.dialogo.confirmar({
        titulo: 'Estás lejos de la sucursal',
        mensaje: `La ubicación da ${Math.round(metros)} m de distancia, con una precisión de ±${Math.round(posicion.precision)} m. La marcación queda registrada con esos datos.`,
        confirmar: 'Marcar igual',
      });
      if (!seguir) {
        this.marcando.set(false);
        this.enCurso.set(null);
        return;
      }
    }

    this.enviar(usuarioId, accion, sucursal, posicion, metros, esSalidaAlmuerzo);
  }

  private distanciaA(sucursal: Sucursal, posicion: Posicion): number | null {
    // `localizacion` guarda "lat,lng" como texto en la sucursal.
    const partes = String(sucursal.localizacion ?? '').split(',');
    const lat = Number(partes[0]);
    const lng = Number(partes[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return this.geo.distanciaMetros(lat, lng, posicion.latitud, posicion.longitud);
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
    posicion: Posicion | null,
    metros: number | null,
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
      latitud: posicion?.latitud,
      longitud: posicion?.longitud,
      precisionGps: posicion?.precision,
      distanciaSucursalMetros: metros ?? undefined,
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
