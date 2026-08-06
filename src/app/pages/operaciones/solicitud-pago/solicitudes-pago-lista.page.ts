import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { SolicitudPago, SolicitudPagoEstado } from 'src/app/domains/pedidos/solicitud-pago.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SolicitudPagoService } from './solicitud-pago.service';

const TAMANO = 10;

interface OpcionFiltro {
  etiqueta: string;
  valor: SolicitudPagoEstado | null;
}

const FILTROS: OpcionFiltro[] = [
  { etiqueta: 'Todas', valor: null },
  { etiqueta: 'Pendientes', valor: SolicitudPagoEstado.PENDIENTE },
  { etiqueta: 'Parciales', valor: SolicitudPagoEstado.PARCIAL },
  { etiqueta: 'Concluidas', valor: SolicitudPagoEstado.CONCLUIDO },
  { etiqueta: 'Canceladas', valor: SolicitudPagoEstado.CANCELADO },
];

/**
 * Solicitudes de pago a proveedores.
 *
 * ⚠️ **La lista no filtra por usuario.** A diferencia de la de recepciones,
 * el backend devuelve las de todos: una solicitud la carga quien recibe la
 * mercadería y la mira quien paga. Filtrarla por el usuario en sesión
 * escondería justamente al segundo.
 */
@Component({
  selector: 'frc-solicitudes-pago-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Solicitudes de pago" [conVolver]="true">
      <div acciones>
        <button matButton="filled" class="nueva" (click)="nueva()">Nueva solicitud</button>
      </div>

      <div class="filtros">
        @for (f of filtros; track f.etiqueta) {
          <button
            type="button"
            class="filtro"
            [class.activo]="filtro() === f.valor"
            (click)="cambiarFiltro(f.valor)"
          >
            {{ f.etiqueta }}
          </button>
        }
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin solicitudes"
          detalle="Las solicitudes de pago que se carguen aparecen acá."
          icono="documento"
        />
      } @else {
        @for (s of filas(); track s.id) {
          <frc-card
            [titulo]="titulo(s)"
            [subtitulo]="subtitulo(s)"
            icono="documento"
            (abrir)="abrir(s)"
          >
            <frc-estado-chip pie enumerado="SolicitudPagoEstado" [valor]="s.estado ?? null" />
            <frc-importe
              aparte
              [valor]="s.montoTotal ?? null"
              [moneda]="s.moneda?.denominacion ?? null"
              [simbolo]="s.moneda?.simbolo ?? null"
            />
          </frc-card>
        }

        @if (hayMas()) {
          <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
            {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
          </button>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .nueva { width: 100%; }
    .filtros { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .filtro {
      border: 1px solid var(--border);
      background: none;
      color: var(--text);
      border-radius: var(--radius-full);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-caption);
      cursor: pointer;
    }
    .filtro.activo {
      background: var(--brand-fill);
      border-color: var(--brand-fill);
      color: var(--on-tono);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class SolicitudesPagoListaPage {
  private readonly servicio = inject(SolicitudPagoService);
  private readonly router = inject(Router);

  readonly filtros = FILTROS;

  readonly filas = signal<SolicitudPago[]>([]);
  readonly filtro = signal<SolicitudPagoEstado | null>(null);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  constructor() {
    this.cargar();
  }

  cargar(agregando = false): void {
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    this.servicio.lista(this.pagina, TAMANO, { estado: this.filtro() }).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
        this.hayMas.set(page?.hasNext === true);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  cargarMas(): void {
    this.pagina += 1;
    this.cargandoMas.set(true);
    this.cargar(true);
  }

  cambiarFiltro(valor: SolicitudPagoEstado | null): void {
    if (this.filtro() === valor) {
      return;
    }
    this.filtro.set(valor);
    this.cargar();
  }

  titulo(s: SolicitudPago): string {
    return s.proveedor?.persona?.nombre ?? 'Proveedor';
  }

  subtitulo(s: SolicitudPago): string {
    const notas = s.notasRecepcion?.length ?? 0;
    const partes = [
      s.numeroSolicitud,
      fechaLegible(s.fechaSolicitud),
      notas === 1 ? '1 nota' : notas + ' notas',
      s.formaPago?.descripcion,
    ];
    return partes.filter(Boolean).join(' · ');
  }

  abrir(s: SolicitudPago): void {
    void this.router.navigate(['/operaciones/solicitud-pago', s.id]);
  }

  nueva(): void {
    void this.router.navigate(['/operaciones/solicitud-pago/nueva']);
  }
}
