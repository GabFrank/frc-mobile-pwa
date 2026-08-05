import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { TransferenciaService } from './transferencia.service';

const TAMANO = 10;

/**
 * Los tres puntos de vista que importan.
 *
 * ⚠️ **Se filtra por `isOrigen` / `isDestino`, no comparando ids.** Los
 * booleanos vienen resueltos por el backend, y son lo que decide qué acciones
 * corresponden: en origen se prepara y despacha, en destino se recibe.
 */
const VISTAS: readonly { etiqueta: string; isOrigen: boolean | null; isDestino: boolean | null }[] =
  [
    { etiqueta: 'Salen', isOrigen: true, isDestino: null },
    { etiqueta: 'Llegan', isOrigen: null, isDestino: true },
    { etiqueta: 'Todas', isOrigen: null, isDestino: null },
  ];

@Component({
  selector: 'frc-transferencias-lista',
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
    <frc-pagina titulo="Transferencias" [conVolver]="true">
      <mat-tab-group
        [selectedIndex]="indice()"
        (selectedIndexChange)="cambiarVista($event)"
        animationDuration="120ms"
      >
        @for (v of vistas; track v.etiqueta) {
          <mat-tab [label]="v.etiqueta" />
        }
      </mat-tab-group>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin transferencias"
          detalle="Acá aparecen los movimientos de mercadería entre sucursales."
          icono="camion"
        />
      } @else {
        @for (t of filas(); track t.id) {
          <frc-card
            [titulo]="ruta(t)"
            [subtitulo]="subtitulo(t)"
            icono="camion"
            (abrir)="abrir(t)"
          >
            <frc-estado-chip
              pie
              enumerado="TransferenciaEstado"
              [valor]="t.estado ?? null"
            />
            @if (t.etapa) {
              <span pie class="etapa">{{ etapaLegible(t) }}</span>
            }
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
    .etapa {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class TransferenciasListaPage {
  private readonly servicio = inject(TransferenciaService);
  private readonly router = inject(Router);

  readonly vistas = VISTAS;
  readonly indice = signal(0);
  readonly filas = signal<Transferencia[]>([]);
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

    const vista = VISTAS[this.indice()];
    this.servicio
      .conFiltros({
        isOrigen: vista.isOrigen,
        isDestino: vista.isDestino,
        page: this.pagina,
        size: TAMANO,
      })
      .subscribe({
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

  cambiarVista(indice: number): void {
    if (indice === this.indice()) {
      return;
    }
    this.indice.set(indice);
    this.cargar();
  }

  ruta(t: Transferencia): string {
    const origen = t.sucursalOrigen?.nombre ?? '—';
    const destino = t.sucursalDestino?.nombre ?? '—';
    return `${origen} → ${destino}`;
  }

  subtitulo(t: Transferencia): string {
    return [`#${t.id}`, fechaLegible(t.creadoEn)].filter(Boolean).join(' · ');
  }

  /** `TRANSPORTE_EN_CAMINO` → `Transporte en camino`. */
  etapaLegible(t: Transferencia): string {
    const crudo = String(t.etapa ?? '').replace(/_/g, ' ').toLowerCase();
    return crudo.charAt(0).toUpperCase() + crudo.slice(1);
  }

  abrir(t: Transferencia): void {
    void this.router.navigate(['/transferencias', t.id]);
  }
}
