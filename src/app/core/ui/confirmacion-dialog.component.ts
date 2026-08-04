import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmacionData {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma. Debe decir qué hace, no "Aceptar". */
  confirmar?: string;
  cancelar?: string;
  /** Aplica el estilo destructivo al botón de confirmación. */
  destructivo?: boolean;
}

/**
 * Diálogo de confirmación único de la app.
 *
 * El botón de confirmación nombra la acción ("Eliminar", "Cerrar caja") en
 * vez de decir "Aceptar": el usuario tiene que poder entender qué va a pasar
 * sin releer el mensaje.
 */
@Component({
  selector: 'frc-confirmacion-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      <p class="mensaje">{{ data.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <!--
        En un diálogo destructivo el foco inicial va en Cancelar, no en el
        botón que borra: si no, un Enter reflejo confirma la eliminación.
        En los no destructivos el foco va en la acción, que es lo esperado.
      -->
      <button matButton [attr.cdkFocusInitial]="data.destructivo ? '' : null" (click)="cerrar(false)">
        {{ data.cancelar ?? 'Cancelar' }}
      </button>
      <button
        matButton="filled"
        [class.destructivo]="data.destructivo"
        [attr.cdkFocusInitial]="data.destructivo ? null : ''"
        (click)="cerrar(true)"
      >
        {{ data.confirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .mensaje {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-body);
      max-width: 40ch;
    }
    .destructivo {
      --mat-button-filled-container-color: var(--danger);
      --mat-button-filled-label-text-color: var(--on-tono);
    }
  `,
})
export class ConfirmacionDialogComponent {
  readonly data = inject<ConfirmacionData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmacionDialogComponent, boolean>);

  cerrar(resultado: boolean): void {
    this.ref.close(resultado);
  }
}
