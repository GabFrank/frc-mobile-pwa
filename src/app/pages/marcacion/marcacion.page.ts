import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { GeoService, PRECISION_MAXIMA_M, Posicion, ProgresoGeo } from 'src/app/core/dispositivo/geo.service';
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
 * ⚠️ **Se ofrece una sola acción: la que el backend dice que corresponde.**
 * Mostrar entrada y salida a la vez permite dos entradas seguidas.
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
          <button matButton="filled" [disabled]="marcando()" (click)="marcar()">
            {{ marcando() ? 'Marcando…' : ETIQUETAS[a] }}
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
  readonly error = signal<string | null>(null);

  readonly jornada = computed(() => this.estado()?.jornadaRelevante ?? null);
  readonly accion = computed(() => this.estado()?.accionPendiente ?? null);
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
    return e.accionPendiente ? `En jornada · falta ${ETIQUETAS[e.accionPendiente].toLowerCase()}` : 'En jornada';
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
  async marcar(): Promise<void> {
    const usuarioId = this.auth.usuario()?.id;
    const accion = this.accion();
    const sucursal = this.sucursales().find((s) => String(s.id) === String(this.sucursalId()));
    if (usuarioId == null || !accion || !sucursal?.id) {
      this.notificacion.warn('Elegí la sucursal donde estás marcando.');
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
        return;
      }
      this.enviar(usuarioId, accion, sucursal, null, null);
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
        return;
      }
    }

    this.enviar(usuarioId, accion, sucursal, posicion, metros);
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

  private enviar(
    usuarioId: number,
    accion: AccionMarcacionPendiente,
    sucursal: Sucursal,
    posicion: Posicion | null,
    metros: number | null,
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
      esSalidaAlmuerzo: accion === AccionMarcacionPendiente.SALIDA,
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
        this.notificacion.ok('Marcación registrada.');
        this.cargar();
      },
      error: (err: Error) => {
        this.marcando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }
}
