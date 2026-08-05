import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import { ROLES } from 'src/app/domains/personas/roles/roles.enum';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
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
    .ancho { width: 100%; }
    .mas { align-self: center; margin-top: var(--sp-3); }
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
            @if (hayMasMarcaciones()) {
              <button
                matButton="outlined"
                class="mas"
                [disabled]="cargandoMas()"
                (click)="masMarcaciones()"
              >
                {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
              </button>
            }
          }
        }
      }

      @if (accion(); as a) {
        <div acciones>
          <button matButton="filled" class="ancho" (click)="solicitar(a.tipo)">
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

  readonly indice = signal(0);
  readonly segmento = computed<Segmento>(() => SEGMENTOS[this.indice()]!.clave);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Segmentos ya traídos: no se vuelve a consultar al cambiar de pestaña. */
  private readonly traidos = new Set<Segmento>();

  /**
   * Paginación de marcaciones. Es el único segmento paginado: hay una fila
   * por día trabajado y crece para siempre, mientras que vales, recibos y
   * vacaciones son unas pocas decenas en toda la vida laboral.
   */
  private paginaMarcaciones = 0;
  readonly hayMasMarcaciones = signal(false);
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
    this.cargarSegmento();
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

    // Un caso por segmento en vez de un mapa con cast: el mapa obligaba a
    // castear la señal destino a `unknown` porque TypeScript no puede
    // relacionar la clave con el tipo que le corresponde.
    const listo = () => {
      this.traidos.add(segmento);
      this.cargando.set(false);
    };
    const fallo = (err: Error) => {
      this.error.set(err.message);
      this.cargando.set(false);
    };

    switch (segmento) {
      case 'recibos':
        this.rrhh.recibos(usuarioId).subscribe({
          next: (d) => { this.recibos.set(d ?? []); listo(); },
          error: fallo,
        });
        break;
      case 'vales':
        this.rrhh.vales(usuarioId).subscribe({
          next: (d) => { this.vales.set(d ?? []); listo(); },
          error: fallo,
        });
        break;
      case 'vacaciones':
        this.rrhh.vacaciones(usuarioId).subscribe({
          next: (d) => { this.vacaciones.set(d ?? []); listo(); },
          error: fallo,
        });
        break;
      case 'marcaciones':
        this.paginaMarcaciones = 0;
        this.rrhh.marcaciones(usuarioId, 0).subscribe({
          next: (d) => {
            const filas = d ?? [];
            this.marcaciones.set(filas);
            // Una página completa es la única señal de que puede haber más:
            // el central devuelve una lista, no un total.
            this.hayMasMarcaciones.set(filas.length === TAMANO_PAGINA);
            listo();
          },
          error: fallo,
        });
        break;
    }
  }

  /**
   * Trae la página siguiente de marcaciones y la agrega al final.
   *
   * Se corta cuando el servidor devuelve menos de una página completa. No hay
   * total: la operación devuelve una lista, no un `Page`.
   */
  masMarcaciones(): void {
    const usuarioId = this.auth.usuario()?.id ?? this.auth.usuarioIdGuardado;
    if (usuarioId == null || this.cargandoMas()) {
      return;
    }
    const siguiente = this.paginaMarcaciones + 1;
    this.cargandoMas.set(true);

    this.rrhh.marcaciones(usuarioId, siguiente).subscribe({
      next: (d) => {
        const filas = d ?? [];
        this.paginaMarcaciones = siguiente;
        this.marcaciones.update((previas) => [...previas, ...filas]);
        this.hayMasMarcaciones.set(filas.length === TAMANO_PAGINA);
        this.cargandoMas.set(false);
      },
      error: () => this.cargandoMas.set(false),
    });
  }

  /** `true` si el usuario puede entrar a la bandeja de aprobaciones. */
  readonly puedeAprobar = computed(() =>
    this.roleService.tieneAlgunRol(this.auth.roles(), [ROLES.ADMIN, ROLES.DIRECTIVO]),
  );

  irAAprobaciones(): void {
    void this.router.navigate(['/mi-trabajo/aprobaciones']);
  }
}
