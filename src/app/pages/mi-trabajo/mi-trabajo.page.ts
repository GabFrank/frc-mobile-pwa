import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { HorarioMarcado, horariosDeJornada } from 'src/app/domains/marcacion/jornada.util';
import { Jornada, Recibo, ResumenRrhh, Vacacion, Vale } from 'src/app/domains/rrhh/rrhh.model';
import { convertMsToTime, fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { RrhhService, TAMANO_PAGINA } from './rrhh.service';
import {
  SolicitudData,
  SolicitudDialogComponent,
  SolicitudResultado,
  TipoSolicitud,
} from './solicitud-dialog.component';
import { DialogoService } from 'src/app/core/ui/dialogo.service';

type Segmento = 'recibos' | 'vales' | 'vacaciones' | 'marcaciones';

// El orden sigue la frecuencia de consulta: la marcación se mira todos los
// días, las vacaciones un par de veces al año.
const SEGMENTOS: readonly { clave: Segmento; etiqueta: string }[] = [
  { clave: 'marcaciones', etiqueta: 'Marcación' },
  { clave: 'vales', etiqueta: 'Vales' },
  { clave: 'recibos', etiqueta: 'Recibos' },
  { clave: 'vacaciones', etiqueta: 'Vacaciones' },
];

/**
 * Autoservicio de RRHH: el funcionario consulta lo suyo y hace solicitudes.
 *
 * **Carga por segmento, no todo junto.** Solo se consulta la pestaña activa,
 * y una vez consultada queda en caché hasta que se recarga a mano. Abrir la
 * pantalla dispara una query, no cuatro — el patrón viene del repo anterior
 * y vale la pena conservarlo.
 */
@Component({
  selector: 'frc-mi-trabajo',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .aprobar { --mat-button-text-label-text-color: var(--on-brand); }
    /*
      La barra reparte el ancho entre sus hijos, pero el botón de Material
      trae ancho automático: sin esto queda chico dentro de su celda.
    */
    .mas { align-self: center; margin-top: var(--sp-3); }
    /*
      Cada fichaje como una pastilla propia. Junta en una sola línea de texto,
      la hora se lee peor que el resto del renglón, y es lo único que se viene
      a mirar acá.
    */
    .horario {
      font-size: var(--fs-caption);
      color: var(--text-soft);
      background: var(--surface-sunken);
      border-radius: var(--radius-full);
      padding: 2px var(--sp-2);
      white-space: nowrap;
    }
  `,
  template: `
    <frc-pagina titulo="Mi trabajo" [conVolver]="true">
      @if (puedeAprobar()) {
        <button accionBarra matButton class="aprobar" (click)="irAAprobaciones()">
          Aprobaciones
        </button>
      }

      @if (resumen(); as r) {
        <frc-seccion titulo="Resumen" [panel]="true">
          <frc-dato etiqueta="Saldo de vacaciones" [valor]="dias(r.saldoVacacionesDias)" />
          <frc-dato etiqueta="Vales pendientes">
            <frc-importe [valor]="r.valesPendientesMonto ?? 0" moneda="Guaraní" simbolo="₲" />
          </frc-dato>
          @if (r.ultimoReciboPeriodo) {
            <frc-dato [etiqueta]="'Último recibo · ' + r.ultimoReciboPeriodo">
              <frc-importe [valor]="r.ultimoReciboNeto ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
          }
        </frc-seccion>
      }

      <mat-tab-group
        [selectedIndex]="indice()"
        (selectedIndexChange)="cambiarSegmento($event)"
        animationDuration="120ms"
      >
        @for (s of segmentos; track s.clave) {
          <mat-tab [label]="s.etiqueta" />
        }
      </mat-tab-group>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargarSegmento(true)" />
      } @else {
        @switch (segmento()) {
          @case ('recibos') {
            @for (r of recibos(); track r.id) {
              <frc-card
                [titulo]="r.periodo ?? 'Recibo ' + r.id"
                [subtitulo]="r.fechaPago ? 'Pagado el ' + fecha(r.fechaPago) : 'Sin fecha de pago'"
                icono="documento"
                (abrir)="verRecibo(r)"
              >
                <frc-estado-chip pie enumerado="LiquidacionSueldoEstado" [valor]="r.estado ?? null" />
                <frc-importe aparte [valor]="r.totalNeto ?? 0" moneda="Guaraní" simbolo="₲" />
              </frc-card>
            } @empty {
              <frc-estado-vacio
                titulo="No tenés recibos"
                detalle="Aparecen acá cuando el sueldo ya fue pagado. Una liquidación aprobada pero sin pagar todavía no se muestra."
                icono="documento"
              />
            }
          }

          @case ('vales') {
            @for (v of vales(); track v.id) {
              <frc-card
                [titulo]="v.esAdelanto ? 'Adelanto' : 'Vale'"
                [subtitulo]="fecha(v.fecha) ?? ''"
                icono="dinero"
                [clickable]="false"
              >
                <frc-estado-chip pie enumerado="ValeEstado" [valor]="v.estado ?? null" />
                <frc-importe aparte [valor]="v.monto ?? 0" moneda="Guaraní" simbolo="₲" />
              </frc-card>
            } @empty {
              <frc-estado-vacio
                titulo="No tenés vales"
                detalle="Solicitá un vale o un adelanto con el botón de abajo."
                icono="dinero"
              />
            }
          }

          @case ('vacaciones') {
            @for (v of vacaciones(); track v.id) {
              <frc-card
                [titulo]="'Año de servicio ' + (v.anioServicio ?? '—')"
                [subtitulo]="disponibles(v) + ' disponibles de ' + (v.diasGenerados ?? 0)"
                icono="reloj"
                [clickable]="false"
              />
            } @empty {
              <frc-estado-vacio
                titulo="Sin saldo vacacional"
                detalle="El saldo se genera al cumplir años de servicio."
                icono="reloj"
              />
            }
          }

          @case ('marcaciones') {
            @for (j of marcaciones(); track j.id) {
              <frc-card
                [titulo]="fecha(j.fecha) ?? 'Sin fecha'"
                [subtitulo]="detalleJornada(j)"
                icono="reloj"
                [clickable]="false"
              >
                <!--
                  Los horarios van al pie y no al subtítulo: el subtítulo es
                  una sola línea con puntos suspensivos, y un día con almuerzo
                  tiene cuatro fichajes que no entran. El pie acomoda en varias.
                -->
                @for (h of horarios(j); track h.clave) {
                  <span pie class="horario">{{ h.etiqueta }} {{ h.hora }}</span>
                }
                <!-- Sin estado no hay chip: uno vacío ocupa lugar sin decir nada. -->
                @if (j.estado) {
                  <frc-estado-chip pie enumerado="EstadoJornada" [valor]="j.estado" />
                }
              </frc-card>
            } @empty {
              <frc-estado-vacio
                titulo="Sin marcaciones"
                detalle="Aparecen acá una vez que el sistema consolida el día."
                icono="reloj"
              />
            }

          }
        }

        @if (hayMas()) {
          <button matButton="outlined" class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
            {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
          </button>
        }
      }

      @if (accion(); as a) {
        <div acciones>
          <button matButton="filled" (click)="solicitar(a.tipo)">
            {{ a.etiqueta }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
})
export class MiTrabajoPage {
  private readonly rrhh = inject(RrhhService);
  private readonly auth = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly pdf = inject(PdfService);
  private readonly dialogo = inject(DialogoService);
  private readonly router = inject(Router);

  readonly segmentos = SEGMENTOS;

  readonly resumen = signal<ResumenRrhh | null>(null);
  readonly recibos = signal<Recibo[]>([]);
  readonly vales = signal<Vale[]>([]);
  readonly vacaciones = signal<Vacacion[]>([]);
  readonly marcaciones = signal<Jornada[]>([]);

  /**
   * Pestaña inicial, por query param.
   *
   * ⚠️ **`input()` y no `input.required`**: el router lo asigna después de
   * construir el componente, y sin el parámetro vale `undefined` — que acá
   * significa «la primera», no un error.
   */
  readonly tab = input<string>();

  readonly indice = signal(0);
  readonly segmento = computed<Segmento>(() => SEGMENTOS[this.indice()]!.clave);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Segmentos ya traídos: no se vuelve a consultar al cambiar de pestaña. */
  private readonly traidos = new Set<Segmento>();

  /**
   * Página actual de cada lista paginada.
   *
   * Vacaciones queda afuera: es un registro por año de servicio, así que ni
   * una carrera entera llena una página.
   */
  private readonly pagina: Record<'marcaciones' | 'recibos' | 'vales', number> = {
    marcaciones: 0,
    recibos: 0,
    vales: 0,
  };

  /**
   * Si el segmento activo puede tener más filas.
   *
   * Se deduce de que la última página haya venido completa: el central
   * devuelve una lista, no un `Page`, así que no hay total con el que
   * comparar. El costo es una consulta de más cuando el total es múltiplo
   * exacto del tamaño de página.
   */
  readonly hayMas = signal(false);
  readonly cargandoMas = signal(false);

  /** La acción del pie depende del segmento: no hay una sola para toda la pantalla. */
  readonly accion = computed<{ tipo: TipoSolicitud; etiqueta: string } | null>(() => {
    switch (this.segmento()) {
      case 'vales':
        return { tipo: 'vale', etiqueta: 'Solicitar vale' };
      case 'vacaciones':
        return { tipo: 'vacacion', etiqueta: 'Solicitar vacaciones' };
      default:
        return null;
    }
  });

  constructor() {
    this.cargarResumen();

    /*
      La pestaña inicial puede venir por query param: `/mi-trabajo?tab=marcaciones`
      es a donde lleva el «Historial» de la pantalla de Marcación.

      ⚠️ **`untracked` alrededor del cuerpo.** Sin él, el efecto también
      seguiría a `indice()` —que lee `cargarSegmento`— y volvería a correr en
      cada cambio de pestaña, disparando una carga que la pestaña ya hizo.
      Depende solo de `tab()`, que es lo que trae la navegación.
    */
    effect(() => {
      const clave = this.tab();
      untracked(() => {
        const indice = SEGMENTOS.findIndex((s) => s.clave === clave);
        if (indice >= 0) {
          this.indice.set(indice);
        }
        this.cargarSegmento();
      });
    });
  }

  cambiarSegmento(indice: number): void {
    this.indice.set(indice);
    this.cargarSegmento();
  }

  dias(n: number | undefined): string {
    return n == null ? '—' : `${n} ${n === 1 ? 'día' : 'días'}`;
  }

  disponibles(v: Vacacion): number {
    // Resta de dos campos que el backend ya calculó, no una regla de negocio.
    return (v.diasGenerados ?? 0) - (v.diasGozados ?? 0);
  }

  fecha(valor: string | undefined): string | null {
    return fechaLegible(valor);
  }

  /**
   * Los horarios que marcó ese día. Los slots vacíos no vuelven.
   *
   * ⚠️ **La hora sale de la marcación, no de la jornada.** `jornada.fecha` es
   * el día; el momento de cada fichaje vive en la marcación, y en un campo
   * distinto según sea entrada o salida. Ver `jornada.util.ts`.
   */
  horarios(j: Jornada): HorarioMarcado[] {
    return horariosDeJornada(j);
  }

  detalleJornada(j: Jornada): string {
    const partes = [`Trabajadas ${this.horas(j.minutosTrabajados)}`];
    if (j.minutosExtras) {
      partes.push(`extras ${this.horas(j.minutosExtras)}`);
    }
    if (j.minutosLlegadaTardia) {
      partes.push(`tardanza ${this.horas(j.minutosLlegadaTardia)}`);
    }
    return partes.join(' · ');
  }

  private horas(minutos: number | undefined): string {
    return convertMsToTime((minutos ?? 0) * 60_000);
  }

  /**
   * Abre el recibo en PDF.
   *
   * ⚠️ La ventana se abre **después** de la respuesta del servidor, así que
   * el bloqueador de popups puede cortarla. `PdfService` cae a una descarga
   * en ese caso, que es lo que el usuario espera igual.
   */
  async verRecibo(recibo: Recibo): Promise<void> {
    if (recibo.id == null) {
      return;
    }
    const base64 = await firstValueFrom(this.rrhh.reciboEnPdf(recibo.id));
    if (base64) {
      this.pdf.abrirBase64(base64, `recibo-${recibo.periodo ?? recibo.id}.pdf`);
    }
  }

  async solicitar(tipo: TipoSolicitud): Promise<void> {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      return;
    }

    const resultado = await this.dialogo.abrir<
      SolicitudDialogComponent,
      SolicitudData,
      SolicitudResultado
    >(SolicitudDialogComponent, {
      tipo,
      diasDisponibles: this.resumen()?.saldoVacacionesDias,
    });

    if (!resultado) {
      return;
    }

    // El segmento cambió en el servidor: se vuelve a traer.
    const alGuardar = () => {
      this.traidos.delete(this.segmento());
      this.cargarSegmento();
      this.cargarResumen();
    };

    if (tipo === 'vale') {
      this.rrhh
        .solicitarVale(usuarioId, resultado.monto ?? 0, resultado.esAdelanto ?? false)
        .subscribe({ next: alGuardar, error: () => undefined });
    } else {
      this.rrhh
        .solicitarVacacion(usuarioId, resultado.desde ?? '', resultado.hasta ?? '')
        .subscribe({ next: alGuardar, error: () => undefined });
    }
  }

  private cargarResumen(): void {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      return;
    }
    this.rrhh.resumen(usuarioId).subscribe({
      next: (r) => this.resumen.set(r),
      // El resumen es un extra: si falla, la pantalla sigue siendo útil.
      error: () => this.resumen.set(null),
    });
  }

  cargarSegmento(forzar = false): void {
    const usuarioId = this.auth.usuario()?.id ?? this.auth.usuarioIdGuardado;
    if (usuarioId == null) {
      this.error.set('No se pudo identificar al usuario en sesión.');
      this.cargando.set(false);
      return;
    }

    const segmento = this.segmento();
    if (!forzar && this.traidos.has(segmento)) {
      this.cargando.set(false);
      this.error.set(null);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const listo = (filas: unknown[], tamano?: number) => {
      this.hayMas.set(tamano != null && filas.length === tamano);
      this.traidos.add(segmento);
      this.cargando.set(false);
    };
    const fallo = (err: Error) => {
      this.error.set(err.message);
      this.cargando.set(false);
    };

    // Un caso por segmento en vez de un mapa: TypeScript no puede relacionar
    // la clave con el tipo de la señal destino, y el mapa obligaba a castear.
    switch (segmento) {
      case 'marcaciones':
        this.pagina.marcaciones = 0;
        this.rrhh.marcaciones(usuarioId, 0).subscribe({
          next: (d) => { this.marcaciones.set(d ?? []); listo(d ?? [], TAMANO_PAGINA.marcaciones); },
          error: fallo,
        });
        break;
      case 'vales':
        this.pagina.vales = 0;
        this.rrhh.vales(usuarioId, 0).subscribe({
          next: (d) => { this.vales.set(d ?? []); listo(d ?? [], TAMANO_PAGINA.vales); },
          error: fallo,
        });
        break;
      case 'recibos':
        this.pagina.recibos = 0;
        this.rrhh.recibos(usuarioId, 0).subscribe({
          next: (d) => { this.recibos.set(d ?? []); listo(d ?? [], TAMANO_PAGINA.recibos); },
          error: fallo,
        });
        break;
      case 'vacaciones':
        this.rrhh.vacaciones(usuarioId).subscribe({
          next: (d) => { this.vacaciones.set(d ?? []); listo(d ?? []); },
          error: fallo,
        });
        break;
    }
  }

  /**
   * Trae la página siguiente del segmento activo y la agrega al final.
   *
   * Se corta cuando el servidor devuelve menos de una página completa.
   */
  cargarMas(): void {
    const usuarioId = this.auth.usuario()?.id ?? this.auth.usuarioIdGuardado;
    const segmento = this.segmento();
    if (usuarioId == null || this.cargandoMas() || segmento === 'vacaciones') {
      return;
    }

    const siguiente = this.pagina[segmento] + 1;
    const tamano = TAMANO_PAGINA[segmento];
    this.cargandoMas.set(true);

    const alLlegar = (filas: unknown[]) => {
      this.pagina[segmento] = siguiente;
      this.hayMas.set(filas.length === tamano);
      this.cargandoMas.set(false);
    };
    const alFallar = () => this.cargandoMas.set(false);

    switch (segmento) {
      case 'marcaciones':
        this.rrhh.marcaciones(usuarioId, siguiente).subscribe({
          next: (d) => { this.marcaciones.update((p) => [...p, ...(d ?? [])]); alLlegar(d ?? []); },
          error: alFallar,
        });
        break;
      case 'vales':
        this.rrhh.vales(usuarioId, siguiente).subscribe({
          next: (d) => { this.vales.update((p) => [...p, ...(d ?? [])]); alLlegar(d ?? []); },
          error: alFallar,
        });
        break;
      case 'recibos':
        this.rrhh.recibos(usuarioId, siguiente).subscribe({
          next: (d) => { this.recibos.update((p) => [...p, ...(d ?? [])]); alLlegar(d ?? []); },
          error: alFallar,
        });
        break;
    }
  }

  /**
   * `true` si el usuario puede entrar a la bandeja de aprobaciones.
   *
   * ⚠️ Antes pedía `DIRECTIVO`, que **no existe en `personas.role`**: el
   * chequeo daba siempre falso y la bandeja quedaba solo para ADMIN, sin
   * forma de delegarla. Ver `permisos.ts`.
   */
  readonly puedeAprobar = computed(() =>
    this.roleService.tieneAlgunRol(this.auth.roles(), PERMISOS.aprobacionesRrhh),
  );

  irAAprobaciones(): void {
    void this.router.navigate(['/mi-trabajo/aprobaciones']);
  }
}
