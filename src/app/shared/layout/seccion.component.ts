import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bloque con título, para agrupar contenido dentro de una pantalla.
 *
 * ⚠️ El cuerpo es una columna flex, así que **estira a sus hijos a lo ancho**.
 * Es lo correcto para listas de cards, pero un botón suelto adentro ocupa
 * todo el ancho. Envolvelo en un contenedor propio si no querés eso.
 */
@Component({
  selector: 'frc-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (titulo()) {
      <h2 class="titulo">{{ titulo() }}</h2>
    }
    <div class="cuerpo" [class.panel]="panel()">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .titulo {
      margin: 0;
      font-size: var(--fs-caption);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-mute);
      font-weight: var(--fw-medium);
    }
    .cuerpo {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .cuerpo.panel {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
    }
  `,
})
export class SeccionComponent {
  readonly titulo = input<string | null>(null);
  /** Envuelve el contenido en una superficie elevada. */
  readonly panel = input(false);
}
