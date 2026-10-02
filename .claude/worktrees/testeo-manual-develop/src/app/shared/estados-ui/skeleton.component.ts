import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder de carga con la forma de lo que va a llegar, para que la
 * pantalla no salte cuando lleguen los datos.
 *
 * Es el estado de carga por defecto de las listas. El spinner queda para
 * acciones puntuales, no para esperar datos.
 */
@Component({
  selector: 'frc-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (fila of filas(); track $index) {
      <div class="card">
        @if (conMiniatura()) {
          <div class="sk thumb"></div>
        }
        <div class="main">
          <div class="sk linea" style="width: 68%"></div>
          <div class="sk linea corta" style="width: 42%"></div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
      display: flex;
      gap: var(--sp-3);
      align-items: flex-start;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      padding-top: var(--sp-1);
    }
    .sk {
      background: var(--surface-sunken);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    .sk::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, var(--border-light), transparent);
      animation: brillo 1.4s infinite;
    }
    .thumb { width: 44px; height: 44px; border-radius: var(--radius-sm); }
    .linea { height: 13px; }
    .linea.corta { height: 11px; }
    @keyframes brillo { to { transform: translateX(100%); } }
  `,
})
export class SkeletonComponent {
  readonly cantidad = input(3);
  readonly conMiniatura = input(false);

  filas(): number[] {
    return Array.from({ length: this.cantidad() });
  }
}
