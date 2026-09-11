import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { BuscadorProductoComponent } from './buscador-producto.component';
import { OpcionesBuscador, SeleccionProducto } from './buscador.types';

/**
 * El buscador como **selector**: se abre, se elige, devuelve.
 *
 * Es la contraparte de la pestaña Buscar, que usa el mismo
 * `frc-buscador-producto` para consultar sin devolver nada. Lo único que
 * agrega este diálogo es cerrarse con lo elegido.
 *
 * ⚠️ **El foco arranca en el campo**, a diferencia de la pestaña. Acá el
 * usuario vino a buscar algo puntual y el teclado tiene que estar listo; en
 * una pestaña que se abre por navegación, levantar el teclado sin que nadie
 * lo pida molesta más de lo que ayuda.
 */
@Component({
  selector: 'frc-buscador-producto-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, BuscadorProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ titulo }}</h2>

    <mat-dialog-content>
      <frc-buscador-producto
        [opciones]="data.opciones ?? {}"
        [autoFoco]="true"
        (seleccion)="elegir($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      /*
        El campo de Material dibuja su etiqueta flotante por encima del borde
        superior, fuera de la caja del contenido: con el overflow auto por
        defecto quedaba recortada.
      */
      padding-top: var(--sp-4);
      min-height: 60vh;
    }
  `,
})
export class BuscadorProductoDialogComponent {
  readonly data = inject<{ titulo?: string; opciones?: OpcionesBuscador }>(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? {};
  private readonly ref =
    inject<MatDialogRef<BuscadorProductoDialogComponent, SeleccionProducto | undefined>>(
      MatDialogRef,
    );

  readonly titulo = this.data.titulo ?? 'Buscar producto';

  elegir(seleccion: SeleccionProducto): void {
    this.ref.close(seleccion);
  }

  cancelar(): void {
    this.ref.close(undefined);
  }
}
