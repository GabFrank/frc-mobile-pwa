import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { esSucursalReal } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { EstadoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';
import { Devolucion } from 'src/app/domains/devolucion/devolucion.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { DevolucionService } from './devolucion.service';

const TAMANO = 10;

/** Los estados que se consultan seguido. `null` es «todos». */
const FILTROS: readonly { etiqueta: string; estado: EstadoDevolucion | null }[] = [
  { etiqueta: 'Pendientes', estado: EstadoDevolucion.PENDIENTE },
  { etiqueta: 'Separadas', estado: EstadoDevolucion.SEPARADO },
  { etiqueta: 'Todas', estado: null },
];

/**
 * Historial de devoluciones.
 *
 * Arranca en **pendientes**, que es lo que hay que atender: cargadas pero
 * todavía en góndola. Las terminadas se consultan, las pendientes se trabajan.
 */
@Component({
  selector: 'frc-devolucion-historial',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Devoluciones" [conVolver]="true">
      <div acciones>
        <button matButton="filled" (click)="nueva()">Nueva devolución</button>
      </div>

      <mat-tab-group
        [selectedIndex]="indice()"
        (selectedIndexChange)="cambiarFiltro($event)"
        animationDuration="120ms"
      >
        @for (f of filtros; track f.etiqueta) {
          <mat-tab [label]="f.etiqueta" />
        }
      </mat-tab-group>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin devoluciones"
          detalle="Las devoluciones que cargues aparecen acá."
          icono="tirar"
          accion="Nueva devolución"
          (ejecutar)="nueva()"
        />
      } @else {
        @for (d of filas(); track d.id) {
          <frc-card
            [titulo]="titulo(d)"
            [subtitulo]="subtitulo(d)"
            icono="tirar"
            (abrir)="abrir(d)"
          >
            <frc-estado-chip pie enumerado="EstadoDevolucion" [valor]="d.estado ?? null" />
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
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class DevolucionHistorialPage {
  private readonly servicio = inject(DevolucionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly filtros = FILTROS;
  readonly indice = signal(0);
  readonly filas = signal<Devolucion[]>([]);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  readonly total = computed(() => this.filas().length);

  constructor() {
    this.cargar();
  }

  cargar(agregando = false): void {
    const sucursalId = this.auth.sucursal()?.id;
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    this.servicio
      .conFiltros({
        // Solo las de la sucursal donde estoy: una devolución se atiende
        // donde está el producto.
        //
        // ⚠️ Salvo que la sesión esté en el SERVIDOR, que no es un local:
        // filtrar por él no devuelve nada, porque ninguna devolución nace
        // ahí. En ese caso se muestran todas — es la sesión de HQ, que mira
        // toda la red. Ver `sucursal.util.ts`.
        sucursalId: esSucursalReal(sucursalId) ? sucursalId : undefined,
        estado: FILTROS[this.indice()].estado,
        page: this.pagina,
        size: TAMANO,
      })
      .subscribe({
        next: (page) => {
          const contenido = page?.getContent ?? [];
          this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
          // `hasNext` viene del Page de Spring: acá sí hay total, a diferencia
          // de las listas de «Mi trabajo».
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

  cambiarFiltro(indice: number): void {
    if (indice === this.indice()) {
      return;
    }
    this.indice.set(indice);
    this.cargar();
  }

  titulo(d: Devolucion): string {
    return d.identificador ? `Devolución ${d.identificador}` : `Devolución ${d.id}`;
  }

  subtitulo(d: Devolucion): string {
    const partes = [d.sucursalOrigen?.nombre, fechaLegible(d.fecha)];
    return partes.filter(Boolean).join(' · ');
  }

  abrir(d: Devolucion): void {
    void this.router.navigate(['/operaciones/devolucion/detalle', d.id]);
  }

  nueva(): void {
    void this.router.navigate(['/operaciones/devolucion/nueva']);
  }
}
