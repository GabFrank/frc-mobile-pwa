import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';

/**
 * Muestra un importe con la precisión de su moneda.
 *
 * Siempre en monoespaciada con `tabular-nums`: en una lista de importes las
 * cifras tienen que alinearse para poder compararlas de un vistazo.
 *
 * Los negativos van en rojo con signo, porque en un arqueo un faltante tiene
 * que saltar a la vista sin leer el número.
 */
@Component({
  selector: 'frc-importe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="importe" [class.negativo]="esNegativo()">{{ texto() }}</span>`,
  styles: `
    .importe {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
      white-space: nowrap;
    }
    .negativo { color: var(--danger); }
    :host([destacado]) .importe { font-size: var(--fs-title); }
  `,
})
export class ImporteComponent {
  readonly valor = input<number | null>(null);
  /** Texto de la moneda; define la precisión. */
  readonly moneda = input<string | null>(null);
  /** Símbolo a anteponer, p. ej. `₲`. */
  readonly simbolo = input<string | null>(null);

  readonly esNegativo = computed(() => (this.valor() ?? 0) < 0);
  readonly texto = computed(() =>
    formatearImporte(this.valor(), this.moneda(), this.simbolo()),
  );
}
