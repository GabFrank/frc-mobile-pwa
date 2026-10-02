import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TextoDialogData {
  titulo: string;
  etiqueta: string;
  valor?: string;
  ayuda?: string;
  /** Tipo del campo. `url` levanta el teclado con `/` y `.` en el teléfono. */
  tipo?: 'text' | 'url';
  confirmar?: string;
}

/**
 * Pide un texto corto. Reemplaza a `window.prompt`.
 *
 * `prompt()` no es una alternativa aceptable en esta app: bloquea el hilo,
 * no se puede estilar —aparece con el chrome del navegador y el "localhost
 * dice" encima—, ignora el tema, y varios navegadores lo suprimen del todo
 * cuando la página corre como PWA instalada. Es decir: la pantalla de
 * configuración del servidor habría dejado de funcionar exactamente en el
 * modo en que se va a usar la app.
 */
@Component({
  selector: 'frc-texto-dialog',
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline" class="campo">
        <mat-label>{{ data.etiqueta }}</mat-label>
        <input
          matInput
          cdkFocusInitial
          [type]="data.tipo ?? 'text'"
          [value]="valor()"
          (input)="alEscribir($event)"
          (keydown.enter)="aceptar()"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        @if (data.ayuda) {
          <mat-hint>{{ data.ayuda }}</mat-hint>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valor().trim()" (click)="aceptar()">
        {{ data.confirmar ?? 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .campo {
      width: 100%;
    }
    mat-dialog-content {
      /*
        La etiqueta flotante del campo se dibuja POR ENCIMA del borde
        superior, fuera de la caja del contenido. Con el overflow auto que
        Material pone por defecto quedaba recortada por la mitad; con el
        padding de 8px, pisada por el borde. Acá el contenido es siempre un
        solo campo, así que no hay nada que scrollear y visible no tiene
        contra.
      */
      overflow: visible;
      padding-top: var(--sp-4);
    }
  `,
})
export class TextoDialogComponent {
  readonly data = inject<TextoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<TextoDialogComponent, string | undefined>>(
    MatDialogRef,
  );

  readonly valor = signal(this.data.valor ?? '');

  alEscribir(evento: Event): void {
    this.valor.set((evento.target as HTMLInputElement).value);
  }

  aceptar(): void {
    const texto = this.valor().trim();
    if (texto) {
      this.ref.close(texto);
    }
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
