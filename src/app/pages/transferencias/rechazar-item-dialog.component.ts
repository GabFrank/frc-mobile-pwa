import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { MotivoRechazo } from 'src/app/domains/transferencia/transferencia.model';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { MOTIVO_RECHAZO_ETIQUETAS } from './etapas';

export interface RechazarItemData {
  /** Qué se está rechazando, para que se vea antes de confirmar. */
  producto: string;
  /** Cómo se llama la etapa en la pantalla: «Preparado», «Recibido»… */
  etiquetaEtapa: string;
}

/**
 * «Esto no va».
 *
 * ⚠️ **Rechazo no es modificación.** Modificar es «va, pero distinto»;
 * rechazar es que el ítem no sale. El central desactiva el movimiento de
 * stock del ítem cuando encuentra un motivo de rechazo en cualquier etapa.
 */
@Component({
  selector: 'frc-rechazar-item-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, SelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Rechazar ítem</h2>

    <mat-dialog-content>
      <p class="producto">{{ data.producto }}</p>
      <p class="aviso">
        El ítem queda rechazado en la etapa «{{ data.etiquetaEtapa }}» y no mueve stock.
      </p>

      <frc-selector
        etiqueta="Motivo del rechazo"
        [opciones]="opciones"
        [valor]="motivo()"
        (valorChange)="motivo.set($any($event))"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="motivo() == null" (click)="aceptar()">
        Rechazar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .producto {
      font-weight: var(--fw-medium);
      margin: 0 0 var(--sp-1);
    }
    .aviso {
      color: var(--text-mute);
      font-size: var(--fs-caption);
      margin: 0 0 var(--sp-3);
    }
  `,
})
export class RechazarItemDialogComponent {
  readonly data = inject<RechazarItemData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<RechazarItemDialogComponent, MotivoRechazo | undefined>>(MatDialogRef);

  readonly motivo = signal<MotivoRechazo | null>(null);

  readonly opciones: OpcionSeleccion[] = Object.values(MotivoRechazo).map((m) => ({
    valor: m,
    texto: MOTIVO_RECHAZO_ETIQUETAS[m],
  }));

  aceptar(): void {
    this.ref.close(this.motivo() ?? undefined);
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
