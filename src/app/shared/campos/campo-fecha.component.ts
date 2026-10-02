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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { IconoComponent } from '../icono/icono.component';
import { aIso, desdeIso } from './fecha-py';
import { PROVEEDORES_FECHA_PY } from './fecha-py.adapter';

/**
 * Campo de fecha con calendario.
 *
 * Reemplaza al `<input type="date">` que el repo venía usando en cuatro
 * módulos. El nativo parece la opción barata y no lo es: en Chrome de
 * escritorio muestra un `dd/mm/aaaa` gris que se lee como un campo roto, en
 * Android abre el diálogo del sistema y en Safari de iOS abre una ruedita.
 * Tres pantallas distintas para el mismo campo, y ninguna que se pueda
 * probar sin el aparato — que es justo lo que la regla 7 del proyecto pide
 * evitar (iOS es un objetivo, no un caso futuro).
 *
 * ⚠️ **El valor entra y sale como texto `yyyy-MM-dd`, nunca como `Date`.**
 * Es lo que manda el central y lo que viajan los inputs de GraphQL; convertir
 * en cada llamador es la forma segura de que alguien use `toISOString()` y
 * corra el día. La conversión vive en `fecha-py.ts`, con sus pruebas.
 *
 * Los proveedores del adaptador van en el componente y no en `app.config.ts`:
 * ver `PROVEEDORES_FECHA_PY`.
 */
@Component({
  selector: 'frc-campo-fecha',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ...PROVEEDORES_FECHA_PY,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoFechaComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
      <mat-label>{{ etiqueta() }}</mat-label>
      <input
        matInput
        [matDatepicker]="calendario"
        [min]="minimoFecha()"
        [max]="maximoFecha()"
        [value]="fecha()"
        [disabled]="inhabilitado()"
        [placeholder]="marcador()"
        (dateChange)="alElegir($event.value)"
        (blur)="alTocarCampo()"
      />
      <!--
        El ícono propio y no el que trae Material: el resto de la app usa el
        juego SVG inline de frc-icono, y mezclarlos deja un solo campo en la
        pantalla con un trazo de otro grosor.
      -->
      <mat-datepicker-toggle matIconSuffix [for]="calendario" [disabled]="inhabilitado()">
        <frc-icono matDatepickerToggleIcon nombre="calendario" [tamano]="20" />
      </mat-datepicker-toggle>
      <mat-datepicker #calendario />
      @if (ayuda()) {
        <mat-hint>{{ ayuda() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    .campo { width: 100%; }
    :host ::ng-deep .mat-mdc-form-field-icon-suffix {
      color: var(--text-mute);
      line-height: 0;
    }
  `,
})
export class CampoFechaComponent implements ControlValueAccessor {
  readonly etiqueta = input('Fecha');
  readonly ayuda = input<string | null>(null);
  readonly deshabilitado = input(false);
  /** Marcador del campo vacío. Se ve solo mientras la etiqueta flota. */
  readonly marcador = input('dd/mm/aaaa');

  /** Límites, en el mismo `yyyy-MM-dd` que el valor. */
  readonly minimo = input<string | null>(null);
  readonly maximo = input<string | null>(null);

  /** ⚠️ Texto `yyyy-MM-dd`, no un `Date`. Vacío y nulo son lo mismo: sin fecha. */
  readonly valor = model<string | null>(null);

  /** Deshabilitado por el FormControl, vía `setDisabledState`. */
  private readonly deshabilitadoPorForm = signal(false);
  readonly inhabilitado = computed(() => this.deshabilitado() || this.deshabilitadoPorForm());

  readonly fecha = computed(() => desdeIso(this.valor()));
  readonly minimoFecha = computed(() => desdeIso(this.minimo()));
  readonly maximoFecha = computed(() => desdeIso(this.maximo()));

  private alTocar: () => void = () => undefined;
  private alCambiarFn: (valor: string | null) => void = () => undefined;

  /**
   * `dateChange` llega tanto del calendario como del texto tipeado, y con
   * `null` cuando lo escrito no es una fecha. Se propaga ese nulo en vez de
   * conservar el valor anterior: si el campo se ve vacío, vacío tiene que
   * estar lo que se guarde.
   */
  alElegir(fecha: Date | null): void {
    const iso = aIso(fecha);
    this.valor.set(iso);
    this.alCambiarFn(iso);
  }

  alTocarCampo(): void {
    this.alTocar();
  }

  writeValue(valor: string | null): void {
    this.valor.set(valor);
  }
  registerOnChange(fn: (valor: string | null) => void): void {
    this.alCambiarFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  /**
   * Sin esto, `formControl.disable()` no tenía efecto en los otros campos del
   * repo: quedaban editables y seguían empujando valores al modelo.
   */
  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorForm.set(deshabilitado);
  }
}
