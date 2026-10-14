import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';

import { InventarioProductoEstado } from 'src/app/domains/inventario/inventario.model';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';

export interface DatosRenglonRepetido {
  productoDescripcion: string;
}

export interface ResultadoRenglonRepetido {
  estado: InventarioProductoEstado;
  /** `yyyy-MM-dd`, o vacío. */
  vencimiento: string;
}

/**
 * Cómo es el renglón nuevo de un producto que la zona ya tiene.
 *
 * El mismo producto se puede cargar otra vez en la zona solo si es **otra
 * cosa**: lo averiado aparte de lo bueno, o mercadería con otro vencimiento.
 * Sin esta pregunta el renglón nacía igual al que ya estaba —bueno y sin
 * fecha— y el central lo rechazaba siempre.
 *
 * ⚠️ **La regla la decide el central**, no este diálogo: acá solo se juntan
 * los datos que distinguen al renglón. Si igual coincide con uno existente
 * (dos averiados con la misma fecha), el mensaje del central lo dice.
 */
@Component({
  selector: 'frc-renglon-repetido-dialog',
  standalone: true,
  imports: [MatButtonModule, MatRadioModule, CampoFechaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Ya está en esta zona</h2>
      <p class="contexto">
        <span class="etiqueta">Producto</span>
        {{ datos.productoDescripcion }}
      </p>
      <p class="nota">Se puede cargar de nuevo solo si es averiado o tiene otro vencimiento.</p>

      <mat-radio-group class="opciones" [value]="tipo()" (change)="tipo.set($event.value)">
        <mat-radio-button value="averiado">Averiado</mat-radio-button>
        <mat-radio-button value="vencimiento">Bueno, con otro vencimiento</mat-radio-button>
      </mat-radio-group>

      <frc-campo-fecha
        [etiqueta]="tipo() === 'averiado' ? 'Vencimiento (opcional)' : 'Vencimiento'"
        [valor]="vencimiento() || null"
        (valorChange)="vencimiento.set($event ?? '')"
      />

      <div class="acciones">
        <button matButton (click)="cerrar()">Cancelar</button>
        <button matButton="filled" [disabled]="!valido()" (click)="agregar()">Agregar</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); }
    .contexto { margin: 0; display: flex; flex-direction: column; }
    .etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }
    .nota { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .opciones { display: flex; flex-direction: column; }
    .acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
  `,
})
export class RenglonRepetidoDialogComponent {
  private readonly ref =
    inject<MatDialogRef<RenglonRepetidoDialogComponent, ResultadoRenglonRepetido | undefined>>(MatDialogRef);
  readonly datos = inject<DatosRenglonRepetido>(MAT_DIALOG_DATA);

  readonly tipo = signal<'averiado' | 'vencimiento'>('averiado');
  readonly vencimiento = signal('');

  /** Bueno sin fecha sería el mismo renglón que ya está. */
  readonly valido = computed(() => this.tipo() === 'averiado' || this.vencimiento() !== '');

  agregar(): void {
    if (!this.valido()) {
      return;
    }
    this.ref.close({
      estado:
        this.tipo() === 'averiado' ? InventarioProductoEstado.AVERIADO : InventarioProductoEstado.BUENO,
      vencimiento: this.vencimiento(),
    });
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
