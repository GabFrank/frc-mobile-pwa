import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Par etiqueta-valor. Unidad de las pantallas de detalle. */
@Component({
  selector: 'frc-dato',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fila">
      <span class="etiqueta">{{ etiqueta() }}</span>
      <span class="valor">
        @if (valor() !== null) {
          {{ valor() }}
        }
        <ng-content />
      </span>
    </div>
  `,
  styles: `
    .fila {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      font-size: var(--fs-label);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    :host(:last-of-type) .fila { border-bottom: none; }
    .etiqueta { color: var(--text-soft); }
    .valor {
      text-align: right;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      justify-content: flex-end;
    }
  `,
})
export class DatoComponent {
  readonly etiqueta = input.required<string>();
  readonly valor = input<string | number | null>(null);
}
