import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { InventarioService } from './inventario.service';

const TAMANO = 10;

/** Inventarios del usuario, del más reciente al más viejo. */
@Component({
  selector: 'frc-inventario-lista',
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
    <frc-pagina titulo="Inventarios" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin inventarios"
          detalle="Las tomas de inventario en las que participes aparecen acá."
          icono="inventario"
        />
      } @else {
        @for (i of filas(); track i.id) {
          <frc-card
            [titulo]="titulo(i)"
            [subtitulo]="subtitulo(i)"
            icono="inventario"
            (abrir)="abrir(i)"
          >
            <frc-estado-chip pie enumerado="InventarioEstado" [valor]="i.estado ?? null" />
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
export class InventarioListaPage {
  private readonly servicio = inject(InventarioService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly filas = signal<Inventario[]>([]);
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

  titulo(i: Inventario): string {
    return `${i.sucursal?.nombre ?? 'Inventario'} · ${i.tipo ?? ''}`.trim();
  }

  subtitulo(i: Inventario): string {
    const partes = [
      `#${i.id}`,
      fechaLegible(i.fechaInicio),
      i.fechaFin ? `hasta ${fechaLegible(i.fechaFin)}` : '',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  abrir(i: Inventario): void {
    void this.router.navigate(['/inventario', i.id]);
  }
}
