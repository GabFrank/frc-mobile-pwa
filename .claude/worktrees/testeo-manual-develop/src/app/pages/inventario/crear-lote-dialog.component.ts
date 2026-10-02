import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';

export interface DatosCrearLote {
  productoDescripcion: string;
  /** Los días de vencimiento del producto, para poder explicar el retiro derivado. */
  diasVencimiento?: number;
}

export interface ResultadoCrearLote {
  numeroLote: string;
  /** `yyyy-MM-dd`, o vacío. */
  fechaVencimiento: string;
  fechaRetiro: string;
}

/**
 * Registrar un lote que el sistema no tenía.
 *
 * Es el caso real del conteo: el operador tiene el envase en la mano y el lote
 * no existe en el sistema, así que no puede contarlo. Acá se da de alta el
 * **maestro** —el lote existe—; la existencia se la pone después la
 * finalización de la toma.
 *
 * ⚠️ **No pide cantidad, y es a propósito.** El lote nace con saldo cero:
 * cuánto hay es justamente lo que el conteo viene a determinar. Un campo de
 * cantidad acá sería contar dos veces.
 *
 * ⚠️ **La fecha de retiro se puede dejar vacía.** El central la deriva de los
 * días de vencimiento del producto, que es el comportamiento histórico. Se
 * ofrece por si el envase dice otra cosa.
 *
 * ⚠️ **El número no se valida contra los existentes.** Si ya existe, el central
 * devuelve ese mismo lote en vez de fallar — la unicidad es
 * `(producto, número)` y ese lote **es** el que el operador tiene en la mano.
 * Chequearlo acá sería tener la regla en dos lados.
 */
@Component({
  selector: 'frc-crear-lote-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    CampoFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Crear nuevo lote</h2>
      <p class="contexto">
        <span class="etiqueta">Producto</span>
        {{ datos.productoDescripcion }}
      </p>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Número de lote</mat-label>
        <!--
          En mayúsculas desde el teclado: es como lo va a guardar el central, y
          que lo escrito coincida con lo guardado evita que el operador crea que
          creó otro lote distinto.
        -->
        <input
          matInput
          class="numero"
          [ngModel]="numero()"
          (ngModelChange)="numero.set($event)"
          autocomplete="off"
          autocapitalize="characters"
          enterkeyhint="done"
        />
      </mat-form-field>

      <frc-campo-fecha
        etiqueta="Vencimiento"
        [valor]="vencimiento() || null"
        (valorChange)="vencimiento.set($event ?? '')"
      />

      <frc-campo-fecha
        etiqueta="Fecha de retiro (opcional)"
        [valor]="retiro() || null"
        (valorChange)="retiro.set($event ?? '')"
      />

      <p class="nota">
        @if (!retiro() && datos.diasVencimiento) {
          Sin cargarla, se calcula {{ datos.diasVencimiento }} días antes del
          vencimiento.
        } @else if (!retiro()) {
          Este producto no tiene días de vencimiento configurados, así que sin
          cargarla el lote queda sin fecha de retiro.
        } @else {
          Es la fecha por la que ordena la salida de mercadería, en todas las
          sucursales.
        }
      </p>

      <div class="acciones">
        <button matButton (click)="cerrar()">Cancelar</button>
        <button matButton="filled" [disabled]="!valido()" (click)="crear()">Crear</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); }
    .contexto { margin: 0; display: flex; flex-direction: column; }
    .etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }
    .numero { text-transform: uppercase; }
    .nota { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
  `,
})
export class CrearLoteDialogComponent {
  private readonly ref =
    inject<MatDialogRef<CrearLoteDialogComponent, ResultadoCrearLote | undefined>>(MatDialogRef);
  readonly datos = inject<DatosCrearLote>(MAT_DIALOG_DATA);

  readonly numero = signal('');
  readonly vencimiento = signal('');
  readonly retiro = signal('');

  /** Solo el número es obligatorio: hay productos con lote y sin vencimiento. */
  readonly valido = computed(() => this.numero().trim().length > 0);

  crear(): void {
    if (!this.valido()) {
      return;
    }
    this.ref.close({
      numeroLote: this.numero().trim().toUpperCase(),
      fechaVencimiento: this.vencimiento(),
      fechaRetiro: this.retiro(),
    });
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
