import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EstadoVisual, TonoEstado, resolverEstado } from './estado-registry';

/**
 * Chip de estado.
 *
 * Dos formas de uso:
 *
 *   <!-- resuelto desde el registro central -->
 *   <frc-estado-chip enumerado="EstadoDevolucion" [valor]="dev.estado" />
 *
 *   <!-- con lo que ya calculó el backend -->
 *   <frc-estado-chip [etiqueta]="p.estadoEtiqueta" [tono]="'warn'" />
 *
 * La segunda existe porque solicitud-gastos recibe `estadoEtiqueta`,
 * `estadoColor` y `estadoIcono` calculados en el central. Ese patrón es el
 * correcto y no hay que romperlo: si el backend agrega un estado, la UI lo
 * refleja sola.
 */
@Component({
  selector: 'frc-estado-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [class]="'t-' + visual().tono" [attr.title]="visual().etiqueta">
      {{ visual().etiqueta }}
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      padding: 2px var(--sp-2);
      border-radius: var(--radius-full);
      white-space: nowrap;
    }
    .chip::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      background: currentColor;
      flex-shrink: 0;
    }
    .t-ok      { color: var(--ok);      background: var(--ok-bg); }
    .t-warn    { color: var(--warn);    background: var(--warn-bg); }
    .t-danger  { color: var(--danger);  background: var(--danger-bg); }
    .t-info    { color: var(--info);    background: var(--info-bg); }
    .t-neutral { color: var(--neutral); background: var(--neutral-bg); }
  `,
})
export class EstadoChipComponent {
  /** Nombre del enum, p. ej. `EstadoDevolucion`. */
  readonly enumerado = input<string | null>(null);
  /** Valor del enum tal como lo emite el backend. */
  readonly valor = input<string | null>(null);

  /** Etiqueta explícita; tiene prioridad sobre el registro. */
  readonly etiqueta = input<string | null>(null);
  /** Tono explícito; acompaña a `etiqueta`. */
  readonly tono = input<TonoEstado | null>(null);

  readonly visual = computed<EstadoVisual>(() => {
    const etiquetaDirecta = this.etiqueta();
    if (etiquetaDirecta) {
      return { etiqueta: etiquetaDirecta, tono: this.tono() ?? 'neutral' };
    }
    const enumerado = this.enumerado();
    if (!enumerado) {
      return { etiqueta: '—', tono: 'neutral' };
    }
    return resolverEstado(enumerado, this.valor());
  });
}
