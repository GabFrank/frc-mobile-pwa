import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { formatearImporte, type MonedaReferencia } from 'src/app/generic/utils/moneda.util';

/**
 * Muestra un importe con la precisión de su moneda.
 *
 * Siempre en monoespaciada con `tabular-nums`: en una lista de importes las
 * cifras tienen que alinearse para poder compararlas de un vistazo.
 *
 * Los negativos van en rojo con signo, porque en un arqueo un faltante tiene
 * que saltar a la vista sin leer el número.
 *
 * **Sin `moneda`, usa la de la empresa** (o la del catálogo con ese
 * `simbolo`), no dos decimales fijos: era lo que mostraba guaraníes con
 * «,00». Lee la moneda de la sesión como signal, así que se corrige solo
 * cuando la sesión termina de cargarla.
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
  /**
   * Texto de la moneda, o la moneda misma (con sus `decimales`); define la
   * precisión. Sin ella, la de la empresa.
   */
  readonly moneda = input<MonedaReferencia>(null);
  /** Símbolo a anteponer, p. ej. `₲`. */
  readonly simbolo = input<string | null>(null);

  private readonly monedas = inject(MonedasSesion);

  readonly esNegativo = computed(() => (this.valor() ?? 0) < 0);
  readonly texto = computed(() =>
    formatearImporte(
      this.valor(),
      this.monedas.paraImporte(this.moneda(), this.simbolo()),
      this.simbolo(),
    ),
  );
}
