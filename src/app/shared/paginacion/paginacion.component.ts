import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconoComponent } from '../icono/icono.component';
import type { PageInfo } from 'src/app/domains/page-info.model';

/**
 * Paginación sobre el modelo `Page` de Spring Data.
 *
 * ⚠️ Los campos llevan el prefijo `get` (`getTotalPages`, `getTotalElements`)
 * porque el central serializa los getters de Java tal cual. Las queries
 * GraphQL deben pedirlos con ese nombre.
 */
@Component({
  selector: 'frc-paginacion',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPaginas() > 1) {
      <nav class="paginacion" aria-label="Paginación">
        <button
          type="button"
          class="nav"
          [disabled]="!hayAnterior()"
          (click)="ir(pagina() - 1)"
          aria-label="Página anterior"
        >
          <frc-icono nombre="atras" [tamano]="18" />
        </button>

        <span class="estado">
          {{ pagina() + 1 }} / {{ totalPaginas() }}
          <span class="total">· {{ totalElementos() }} items</span>
        </span>

        <button
          type="button"
          class="nav siguiente"
          [disabled]="!haySiguiente()"
          (click)="ir(pagina() + 1)"
          aria-label="Página siguiente"
        >
          <frc-icono nombre="atras" [tamano]="18" />
        </button>
      </nav>
    }
  `,
  styles: `
    .paginacion {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      padding: var(--sp-2);
    }
    .nav {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      padding: var(--sp-2);
      cursor: pointer;
      line-height: 0;
    }
    .nav:disabled { opacity: 0.4; cursor: not-allowed; }
    .nav.siguiente { transform: rotate(180deg); }
    .estado {
      font-size: var(--fs-label);
      color: var(--text-soft);
      font-variant-numeric: tabular-nums;
    }
    .total { color: var(--text-mute); }
  `,
})
export class PaginacionComponent {
  /** Página actual, base 0. */
  readonly pagina = input(0);
  readonly page = input<PageInfo<unknown> | null>(null);

  readonly cambiar = output<number>();

  readonly totalPaginas = computed(() => this.page()?.getTotalPages ?? 0);
  readonly totalElementos = computed(() => this.page()?.getTotalElements ?? 0);
  readonly hayAnterior = computed(() => this.pagina() > 0);
  readonly haySiguiente = computed(() => this.pagina() + 1 < this.totalPaginas());

  ir(destino: number): void {
    if (destino < 0 || destino >= this.totalPaginas()) {
      return;
    }
    this.cambiar.emit(destino);
  }
}
