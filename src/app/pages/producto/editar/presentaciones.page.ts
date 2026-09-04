import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { ProductoEditarService } from './producto-editar.service';

/**
 * Lista de presentaciones del producto.
 *
 * ⚠️ **La cantidad lidera, no el nombre** —`Cantidad: 12 (Caja)`—: es lo que
 * decide el precio y lo que se compara entre filas. Reusa
 * `etiquetaPresentacion()`, la misma regla que ya aplica `frc-producto-card`.
 *
 * Los códigos y precios de cada presentación se editan **dentro** de ella,
 * no acá: cuelgan de la presentación, no del producto. Por eso cada fila abre
 * `presentacion/:presentacionId` y de ahí se llega a sus códigos y precios.
 */
@Component({
  selector: 'frc-presentaciones',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Presentaciones" [conVolver]="true">
      <button accionBarra matButton type="button" (click)="agregar()">Agregar</button>

      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (estado.producto()) {
        @if (presentaciones().length === 0) {
          <frc-estado-vacio
            titulo="Este producto no tiene presentaciones"
            detalle="Agregá al menos una para poder vender el producto."
            accion="Agregar presentación"
            (ejecutar)="agregar()"
          />
        } @else {
          <frc-seccion [panel]="true">
            @for (p of presentaciones(); track p.id) {
              <button type="button" class="fila" (click)="abrir(p)">
                <span class="datos">
                  <span class="titulo">
                    {{ etiqueta(p) }}
                    @if (p.principal) {
                      <span class="badge">Principal</span>
                    }
                  </span>
                  <span class="sub">
                    {{ p.codigos?.length ?? 0 }} código(s) · {{ p.precios?.length ?? 0 }} precio(s)
                    @if (!p.activo) {
                      · Inactiva
                    }
                  </span>
                </span>
                <span class="chevron" aria-hidden="true">›</span>
              </button>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-bottom: 1px solid var(--border-light);
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .fila:last-child { border-bottom: none; }
    .fila:hover { background: var(--surface-sunken); }
    .datos {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      min-width: 0;
    }
    .titulo {
      font-weight: var(--fw-medium);
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .badge {
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      color: var(--brand-text);
      background: var(--surface-sunken);
      border-radius: var(--radius-sm);
      padding: 2px var(--sp-2);
    }
    .sub {
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .chevron {
      color: var(--text-soft);
      flex-shrink: 0;
    }
  `,
})
export class PresentacionesPage {
  readonly id = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly router = inject(Router);

  readonly presentaciones = computed(() => this.estado.presentaciones());

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  etiqueta(p: Presentacion): string {
    return etiquetaPresentacion(p);
  }

  abrir(p: Presentacion): void {
    this.router.navigate(['/producto', this.id(), 'editar', 'presentacion', p.id]);
  }

  agregar(): void {
    this.router.navigate(['/producto', this.id(), 'editar', 'presentacion', 'nueva']);
  }
}
