import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import {
  MOTIVO_RECHAZO_ETIQUETAS,
  MotivoRechazoFisico,
} from 'src/app/domains/pedidos/recepcion.model';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';

export interface MotivoRechazoData {
  /** Cuántos productos quedarían rechazados con este motivo. */
  cantidadProductos: number;
  /** Los primeros nombres, para que se vea qué se está por rechazar. */
  ejemplos: string[];
}

/**
 * Motivo con el que se rechaza todo lo que quedó sin verificar al finalizar.
 *
 * ⚠️ **Finalizar con pendientes no los deja pendientes: los rechaza.** El
 * diálogo dice cuántos y cuáles, porque después de cerrar la única forma de
 * volver atrás es reabrir la recepción.
 */
@Component({
  selector: 'frc-motivo-rechazo-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, SelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Quedan productos sin verificar</h2>

    <mat-dialog-content>
      <p class="aviso">
        {{ data.cantidadProductos }}
        {{ data.cantidadProductos === 1 ? 'producto se va a rechazar' : 'productos se van a rechazar' }}
        al finalizar.
      </p>
      @if (data.ejemplos.length > 0) {
        <p class="ejemplos">{{ data.ejemplos.join(', ') }}{{ hayMas() ? ' y otros' : '' }}</p>
      }

      <frc-selector
        etiqueta="Motivo del rechazo"
        [opciones]="opciones"
        [valor]="motivo()"
        (valorChange)="motivo.set($any($event))"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="motivo() == null" (click)="confirmar()">
        Finalizar y rechazar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .aviso { font-weight: var(--fw-medium); }
    .ejemplos {
      color: var(--text-mute);
      font-size: var(--fs-caption);
      margin-bottom: var(--sp-3);
    }
  `,
})
export class MotivoRechazoDialogComponent {
  readonly data = inject<MotivoRechazoData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<MotivoRechazoDialogComponent, MotivoRechazoFisico | undefined>>(
      MatDialogRef,
    );

  readonly motivo = signal<MotivoRechazoFisico | null>(null);

  readonly opciones: OpcionSeleccion[] = Object.values(MotivoRechazoFisico).map((m) => ({
    valor: m,
    texto: MOTIVO_RECHAZO_ETIQUETAS[m],
  }));

  hayMas(): boolean {
    return this.data.cantidadProductos > this.data.ejemplos.length;
  }

  confirmar(): void {
    this.ref.close(this.motivo() ?? undefined);
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
