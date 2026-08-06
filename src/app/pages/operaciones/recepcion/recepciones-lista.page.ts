import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { RecepcionMercaderia } from 'src/app/domains/pedidos/recepcion.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { RecepcionService } from './recepcion.service';

const TAMANO = 10;

/**
 * Recepciones del usuario, de la más reciente a la más vieja.
 *
 * El backend filtra por usuario: cada uno ve las recepciones que inició. No
 * es la vista del jefe de depósito —esa vive en el desktop—, es la del que
 * está descargando el camión.
 */
@Component({
  selector: 'frc-recepciones-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Recepción de mercadería" [conVolver]="true">
      <div acciones>
        <button matButton="filled" (click)="nueva()">Nueva recepción</button>
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin recepciones"
          detalle="Las recepciones que inicies aparecen acá."
          icono="camion"
        />
      } @else {
        @for (r of filas(); track r.id) {
          <frc-card
            [titulo]="titulo(r)"
            [subtitulo]="subtitulo(r)"
            icono="camion"
            (abrir)="abrir(r)"
          >
            <frc-estado-chip pie enumerado="RecepcionMercaderiaEstado" [valor]="r.estado ?? null" />
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
export class RecepcionesListaPage {
  private readonly servicio = inject(RecepcionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly filas = signal<RecepcionMercaderia[]>([]);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  constructor() {
    this.cargar();
  }

  cargar(agregando = false): void {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      this.error.set('La sesión no tiene usuario.');
      this.cargando.set(false);
      return;
    }
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    this.servicio.delUsuario(usuarioId, this.pagina, TAMANO).subscribe({
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

  titulo(r: RecepcionMercaderia): string {
    return r.proveedor?.persona?.nombre ?? 'Recepción';
  }

  subtitulo(r: RecepcionMercaderia): string {
    const notas = r.notas?.length ?? 0;
    const partes = [
      '#' + r.id,
      r.sucursalRecepcion?.nombre,
      fechaLegible(r.fecha),
      notas === 1 ? '1 nota' : notas + ' notas',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  abrir(r: RecepcionMercaderia): void {
    void this.router.navigate(['/operaciones/recepcion', r.id]);
  }

  nueva(): void {
    void this.router.navigate(['/operaciones/recepcion/nueva']);
  }
}
