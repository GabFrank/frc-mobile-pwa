import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import {
  NotificacionDestinatario,
  descripcionDeTipo,
} from 'src/app/domains/notificacion/notificacion.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { NotificacionesService } from './notificacion.service';

const TAMANO = 15;

/** `null` es «todas»: el backend distingue `leidas` true / false / sin filtro. */
const FILTROS: readonly { etiqueta: string; leidas: boolean | null }[] = [
  { etiqueta: 'Sin leer', leidas: false },
  { etiqueta: 'Todas', leidas: null },
];

/**
 * Bandeja de notificaciones.
 *
 * Arranca en **sin leer**, que es lo que hay que atender. Tocar una la marca
 * como leída y abre su hilo de comentarios: son eventos de control —un
 * descuadre de maletín, una venta con stock negativo— que alguien tiene que
 * investigar, no avisos que se descartan.
 */
@Component({
  selector: 'frc-notificaciones',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Notificaciones" [conVolver]="true">
      <button accionBarra matButton class="claro" (click)="irAPreferencias()">Preferencias</button>

      @if (filas().length > 0 && servicio.noLeidas() > 0) {
        <div acciones>
          <button matButton (click)="marcarTodas()">Marcar todas como leídas</button>
        </div>
      }

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
        <frc-skeleton [cantidad]="5" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          [titulo]="indice() === 0 ? 'Nada sin leer' : 'Sin notificaciones'"
          detalle="Acá llegan los avisos que necesitan que alguien responda."
          icono="bandeja"
        />
      } @else {
        @for (d of filas(); track d.id) {
          <frc-card
            [titulo]="d.notificacion?.titulo ?? descripcion(d)"
            [subtitulo]="subtitulo(d)"
            icono="bandeja"
            (abrir)="abrir(d)"
          >
            @if (!d.leida) {
              <span pie class="sin-leer">Sin leer</span>
            }
            @if ((d.notificacion?.conteoComentarios ?? 0) > 0) {
              <span pie class="comentarios">
                {{ d.notificacion!.conteoComentarios }} comentario{{
                  d.notificacion!.conteoComentarios === 1 ? '' : 's'
                }}
              </span>
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
    .claro { --mat-button-text-label-text-color: var(--on-brand); }
    .sin-leer {
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      color: var(--brand-text);
    }
    .comentarios {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class NotificacionesPage {
  readonly servicio = inject(NotificacionesService);
  private readonly router = inject(Router);

  readonly filtros = FILTROS;
  readonly indice = signal(0);
  readonly filas = signal<NotificacionDestinatario[]>([]);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  constructor() {
    this.cargar();
    this.servicio.refrescarConteo().subscribe();
  }

  cargar(agregando = false): void {
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    this.servicio
      .lista({ leidas: FILTROS[this.indice()].leidas, page: this.pagina, size: TAMANO })
      .subscribe({
        next: (pagina) => {
          const contenido = pagina?.content ?? [];
          this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
          const total = pagina?.totalPages ?? 0;
          this.hayMas.set(this.pagina + 1 < total);
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

  descripcion(d: NotificacionDestinatario): string {
    return descripcionDeTipo(d.notificacion?.tipo);
  }

  subtitulo(d: NotificacionDestinatario): string {
    const partes = [d.notificacion?.mensaje, fechaLegible(d.creadoEn)];
    return partes.filter(Boolean).join(' · ');
  }

  /**
   * Abrir marca como leída y lleva al hilo.
   *
   * Se marca **antes** de navegar y sin esperar la respuesta: el contador es
   * informativo y hacer esperar al usuario por él no aporta nada. Si falla,
   * la próxima consulta del conteo lo corrige.
   */
  abrir(d: NotificacionDestinatario): void {
    const id = d.notificacion?.id;
    if (id == null) {
      return;
    }
    if (!d.leida) {
      this.servicio.marcarLeida(id).subscribe({ error: () => undefined });
    }
    void this.router.navigate(['/notificaciones', id]);
  }

  marcarTodas(): void {
    this.servicio.marcarTodasLeidas().subscribe({
      next: () => this.cargar(),
      error: () => undefined,
    });
  }

  irAPreferencias(): void {
    void this.router.navigate(['/notificaciones/preferencias']);
  }
}
