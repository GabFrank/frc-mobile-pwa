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
import { MatSelectModule } from '@angular/material/select';

export interface OpcionSeleccion {
  valor: unknown;
  texto: string;
  /** Texto secundario, p. ej. un código. */
  detalle?: string;
}

/**
 * Selector uniforme.
 *
 * ⚠️ La comparación de valores es por `String(a) === String(b)`, porque los
 * ids llegan a veces como número y a veces como string desde GraphQL. Como
 * consecuencia **no se pueden usar objetos como valor**: todos colapsarían a
 * `[object Object]`. Usá ids primitivos.
 */
@Component({
  selector: 'frc-selector',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
      <mat-label>{{ etiqueta() }}</mat-label>
      <mat-select
        [value]="valor()"
        [compareWith]="comparar"
        [disabled]="inhabilitado()"
        (selectionChange)="alCambiar($event.value)"
      >
        @for (op of opciones(); track op.valor) {
          <mat-option [value]="op.valor">
            {{ op.texto }}
            @if (op.detalle) {
              <span class="detalle">· {{ op.detalle }}</span>
            }
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    .campo { width: 100%; }
    .detalle { color: var(--text-mute); font-size: var(--fs-caption); }
  `,
})
export class SelectorComponent implements ControlValueAccessor {
  readonly etiqueta = input('');
  readonly opciones = input<OpcionSeleccion[]>([]);
  readonly deshabilitado = input(false);
  readonly valor = model<unknown>(null);

  /** Deshabilitado por el FormControl, vía `setDisabledState`. */
  private readonly deshabilitadoPorForm = signal(false);
  /** El campo está inhabilitado por cualquiera de las dos vías. */
  readonly inhabilitado = computed(() => this.deshabilitado() || this.deshabilitadoPorForm());

  private alTocar: () => void = () => undefined;
  private alCambiarFn: (valor: unknown) => void = () => undefined;

  readonly comparar = (a: unknown, b: unknown): boolean => {
    if (a == null || b == null) {
      return a === b;
    }
    return String(a) === String(b);
  };

  alCambiar(valor: unknown): void {
    this.valor.set(valor);
    this.alCambiarFn(valor);
    this.alTocar();
  }

  writeValue(valor: unknown): void {
    this.valor.set(valor);
  }
  registerOnChange(fn: (valor: unknown) => void): void {
    this.alCambiarFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  /**
   * Sin esto, `formControl.disable()` no tenía efecto: el control seguía
   * editable y seguía empujando valores al modelo aunque el formulario lo
   * considerara deshabilitado.
   */
  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorForm.set(deshabilitado);
  }
}
