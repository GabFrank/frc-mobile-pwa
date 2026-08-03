import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  formatearImporte,
  parsearImporte,
  precisionDe,
  redondearAMoneda,
} from 'src/app/generic/utils/moneda.util';

/**
 * Campo de importe.
 *
 * Existe como componente porque encapsula una regla de negocio: **el guaraní
 * no lleva decimales**. Al perder el foco redondea a la precisión de la
 * moneda, así que nunca se envía al backend un importe en guaraníes con
 * decimales — que es un dato inválido, no un detalle de presentación.
 *
 * Alineado a la derecha y en monoespaciada, igual que se muestra después en
 * las listas.
 */
@Component({
  selector: 'frc-campo-importe',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoImporteComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
      <mat-label>{{ etiqueta() }}</mat-label>
      @if (simbolo()) {
        <span matTextPrefix class="simbolo">{{ simbolo() }}&nbsp;</span>
      }
      <input
        matInput
        class="entrada"
        inputmode="decimal"
        [value]="texto()"
        [disabled]="inhabilitado()"
        (input)="alEscribir($event)"
        (blur)="alSalir()"
      />
      @if (ayuda()) {
        <mat-hint>{{ ayuda() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    .campo { width: 100%; }
    .entrada {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .simbolo { color: var(--text-mute); }
  `,
})
export class CampoImporteComponent implements ControlValueAccessor {
  readonly etiqueta = input('Monto');
  /** Texto de la moneda; define la precisión. */
  readonly moneda = input<string | null>(null);
  readonly simbolo = input<string | null>(null);
  readonly ayuda = input<string | null>(null);
  readonly deshabilitado = input(false);

  /** Deshabilitado por el FormControl, vía `setDisabledState`. */
  private readonly deshabilitadoPorForm = signal(false);
  /** El campo está inhabilitado por cualquiera de las dos vías. */
  readonly inhabilitado = computed(() => this.deshabilitado() || this.deshabilitadoPorForm());

  readonly valor = model<number | null>(null);
  /** Texto en edición; se separa del valor para no reformatear mientras se tipea. */
  private readonly enEdicion = signal<string | null>(null);

  readonly precision = computed(() => precisionDe(this.moneda()));
  readonly texto = computed(() => {
    const editando = this.enEdicion();
    if (editando !== null) {
      return editando;
    }
    return formatearImporte(this.valor(), this.moneda());
  });

  private alTocar: () => void = () => undefined;
  private alCambiarFn: (valor: number | null) => void = () => undefined;

  alEscribir(evento: Event): void {
    const crudo = (evento.target as HTMLInputElement).value;
    this.enEdicion.set(crudo);
    const parseado = parsearImporte(crudo);
    this.valor.set(parseado);
    this.alCambiarFn(parseado);
  }

  /** Al salir del campo se normaliza: redondeo a la moneda y formato. */
  alSalir(): void {
    const actual = this.valor();
    if (actual != null) {
      const redondeado = redondearAMoneda(actual, this.moneda());
      this.valor.set(redondeado);
      this.alCambiarFn(redondeado);
    }
    this.enEdicion.set(null);
    this.alTocar();
  }

  writeValue(valor: number | null): void {
    this.valor.set(valor);
    this.enEdicion.set(null);
  }
  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiarFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  /**
   * Sin esto, `formControl.disable()` no tenía efecto: el campo seguía
   * editable y seguía empujando valores al modelo.
   */
  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorForm.set(deshabilitado);
  }
}
